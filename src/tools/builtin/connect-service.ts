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

          // Google uses OAuth 2.0 -- redirect to the google_oauth tool
          if (service === "google") {
            // If client_id and client_secret are provided, store them for the OAuth flow
            if (credentials) {
              if (credentials.client_id) {
                setSecret("google_client_id", credentials.client_id, "google");
              }
              if (credentials.client_secret) {
                setSecret("google_client_secret", credentials.client_secret, "google");
              }
            }

            // Install the integration skill templates
            const installed = installIntegration(paths.skills, service);
            if (installed.length > 0) {
              try {
                await loadSkills(paths.skills);
                logger.info(`Google integration skills installed: ${installed.join(", ")}`);
              } catch (err: any) {
                logger.error(`Failed to load Google integration skills: ${err.message}`);
              }
            }

            return JSON.stringify({
              success: true,
              service: "google",
              skills_installed: installed,
              message:
                "Google integration skills installed. Google requires OAuth 2.0 to authenticate. " +
                "Use the google_oauth tool with action 'start' to complete the connection. " +
                "You will need a client_id and client_secret from the Google Cloud Console.",
              next_step: "Use google_oauth tool with action 'start', providing client_id and client_secret.",
            });
          }

          // Validate required credentials per service
          const REQUIRED_SECRETS: Record<string, { keys: string[]; guide: string }> = {
            github: {
              keys: ["github_token"],
              guide: "Requires a GitHub Personal Access Token (PAT). Get one at: GitHub > Settings > Developer settings > Personal access tokens. Needs scopes: repo, read:org.",
            },
            notion: {
              keys: ["notion_token"],
              guide: "Requires a Notion Internal Integration Token. Create one at: notion.so/my-integrations. Then share your pages/databases with the integration.",
            },
            linear: {
              keys: ["linear_token"],
              guide: "Requires a Linear Personal API Key. Get one at: Linear > Settings > API > Personal API keys.",
            },
            slack: {
              keys: ["slack_token"],
              guide: "Requires a Slack Bot Token (xoxb-...). Create a Slack app at api.slack.com/apps, add Bot Token Scopes (channels:read, channels:history, chat:write, search:read), then install to workspace.",
            },
            jira: {
              keys: ["jira_token", "jira_email", "jira_url"],
              guide: "Requires 3 credentials: jira_email (your Atlassian email), jira_token (API token from id.atlassian.com/manage-profile/security/api-tokens), and jira_url (e.g. https://yourteam.atlassian.net).",
            },
            twitter: {
              keys: ["twitter_bearer_token"],
              guide: "For reading: provide twitter_bearer_token (from developer.twitter.com > App > Keys and tokens). For posting: also need twitter_api_key, twitter_api_secret, twitter_access_token, twitter_access_secret.",
            },
          };

          const serviceInfo = REQUIRED_SECRETS[service];

          // If no credentials provided, return guidance
          if (!credentials || Object.keys(credentials).length === 0) {
            if (serviceInfo) {
              return JSON.stringify({
                error: "No credentials provided.",
                required_secrets: serviceInfo.keys,
                guide: serviceInfo.guide,
              });
            }
          }

          // Store credentials
          if (credentials) {
            for (const [name, value] of Object.entries(credentials)) {
              setSecret(name, value, service);
            }
          }

          // Check if all required keys were provided
          let missingKeys: string[] = [];
          if (serviceInfo) {
            for (const key of serviceInfo.keys) {
              if (!credentials || !credentials[key]) {
                missingKeys.push(key);
              }
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

          const result: Record<string, unknown> = {
            success: true,
            service,
            skills_installed: installed,
            message: `Service "${service}" connected. ${installed.length} skill(s) installed and ready: ${installed.join(", ")}`,
          };

          if (missingKeys.length > 0) {
            result.warning = `Missing credentials: ${missingKeys.join(", ")}. Some features may not work.`;
            if (serviceInfo) result.guide = serviceInfo.guide;
          }

          return JSON.stringify(result);
        }

        default:
          return JSON.stringify({ error: `Unknown action: ${action}` });
      }
    },
  });
}
