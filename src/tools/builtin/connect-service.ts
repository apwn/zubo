import { registerTool } from "../registry";
import { listAvailableIntegrations, installIntegration } from "../integration-installer";
import { setSecret } from "../../secrets/store";
import { loadSkills } from "../skill-loader";
import { paths } from "../../config/paths";
import { logger } from "../../util/logger";

export function registerConnectServiceTool() {
  registerTool({
    definition: {
      name: "connect_service",
      description:
        "Connect an external service (GitHub, Google, Notion, etc.) by storing credentials and installing pre-built integration skills. Use action 'list' to see available integrations, or 'connect' to set up a service.",
      input_schema: {
        type: "object",
        properties: {
          action: {
            type: "string",
            enum: ["list", "connect"],
            description: "The action to perform",
          },
          service: {
            type: "string",
            description:
              "Service name to connect (e.g., 'github', 'google', 'notion'). Required for connect.",
          },
          credentials: {
            type: "object",
            description:
              "Key-value pairs of credential names and values (e.g., { \"github_token\": \"ghp_...\" }). Required for connect.",
          },
        },
        required: ["action"],
      },
    },
    execute: async (input) => {
      const { action, service, credentials } = input as {
        action: string;
        service?: string;
        credentials?: Record<string, string>;
      };

      switch (action) {
        case "list": {
          const integrations = listAvailableIntegrations();
          if (integrations.length === 0) {
            return "No integrations available.";
          }
          return JSON.stringify({
            integrations: integrations.map((i) => ({
              service: i.service,
              skills: i.skills,
              required_secret: i.secret_name,
            })),
          });
        }

        case "connect": {
          if (!service) {
            return JSON.stringify({ error: "service is required for connect" });
          }

          // Validate service name to prevent path traversal
          if (!/^[a-z0-9_-]+$/.test(service)) {
            return JSON.stringify({
              error: "Invalid service name. Must contain only lowercase letters, numbers, hyphens, and underscores.",
            });
          }

          // Store credentials
          if (credentials) {
            for (const [name, value] of Object.entries(credentials)) {
              setSecret(name, value, service);
            }
          }

          // Install integration skills
          const installed = installIntegration(paths.skills, service);
          if (installed.length === 0) {
            return JSON.stringify({
              error: `No integration templates found for service "${service}". Credentials were stored if provided.`,
            });
          }

          // Hot-load newly installed skills
          try {
            const loaded = await loadSkills(paths.skills);
            logger.info(
              `Integration "${service}" connected. Skills: ${installed.join(", ")}`
            );
          } catch (err: any) {
            logger.error(`Failed to load integration skills: ${err.message}`);
          }

          return JSON.stringify({
            success: true,
            service,
            skills_installed: installed,
            message: `Service "${service}" connected. ${installed.length} skill(s) installed and ready: ${installed.join(", ")}`,
          });
        }

        default:
          return JSON.stringify({ error: `Unknown action: ${action}` });
      }
    },
  });
}
