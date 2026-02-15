import { registerTool } from "../registry";
import { setSecret, getSecret, listSecrets, deleteSecret } from "../../secrets/store";

export function registerSecretTools() {
  registerTool({
    definition: {
      name: "secret_set",
      description:
        "Store a secret (API key, token, credential). The value is saved securely and never shown in conversation. Use this when the user provides credentials.",
      input_schema: {
        type: "object",
        properties: {
          name: {
            type: "string",
            description:
              "Secret name (e.g., 'github_token', 'google_api_key'). Use lowercase with underscores.",
          },
          value: {
            type: "string",
            description: "The secret value (API key, token, etc.)",
          },
          service: {
            type: "string",
            description:
              "Optional service name this secret belongs to (e.g., 'github', 'google', 'notion')",
          },
        },
        required: ["name", "value"],
      },
    },
    execute: async (input) => {
      const { name, value, service } = input as {
        name: string;
        value: string;
        service?: string;
      };

      if (!name || !/^[a-z0-9_]+$/.test(name)) {
        return JSON.stringify({ error: "Invalid name. Must match [a-z0-9_]+" });
      }
      if (!value) {
        return JSON.stringify({ error: "Value is required." });
      }

      setSecret(name, value, service);
      return JSON.stringify({
        success: true,
        name,
        service: service ?? null,
        message: `Secret "${name}" stored securely.`,
      });
    },
  });

  registerTool({
    definition: {
      name: "secret_get",
      description:
        "Retrieve the value of a stored secret. Use this to access API keys, tokens, and credentials needed for tool calls and integrations.",
      input_schema: {
        type: "object",
        properties: {
          name: {
            type: "string",
            description: "The name of the secret to retrieve (e.g., 'github_token', 'google_client_id')",
          },
        },
        required: ["name"],
      },
    },
    execute: async (input) => {
      const { name } = input as { name: string };
      if (!name) {
        return JSON.stringify({ error: "Secret name is required." });
      }

      const value = getSecret(name);
      if (value === null) {
        return JSON.stringify({ error: `No secret found with name "${name}".` });
      }

      return JSON.stringify({ name, value });
    },
  });

  registerTool({
    definition: {
      name: "secret_list",
      description:
        "List stored secret names (never shows values). Use this to check what credentials are available.",
      input_schema: {
        type: "object",
        properties: {
          service: {
            type: "string",
            description: "Optional: filter by service name (e.g., 'github')",
          },
        },
      },
    },
    execute: async (input) => {
      const { service } = input as { service?: string };
      const secrets = listSecrets(service);

      if (secrets.length === 0) {
        return service
          ? `No secrets found for service "${service}".`
          : "No secrets stored yet.";
      }

      return JSON.stringify({
        secrets: secrets.map((s) => ({
          name: s.name,
          service: s.service,
          updated_at: s.updated_at,
        })),
        count: secrets.length,
      });
    },
  });

  registerTool({
    definition: {
      name: "secret_delete",
      description: "Delete a stored secret by name.",
      input_schema: {
        type: "object",
        properties: {
          name: {
            type: "string",
            description: "The name of the secret to delete",
          },
        },
        required: ["name"],
      },
    },
    execute: async (input) => {
      const { name } = input as { name: string };
      if (!name) {
        return JSON.stringify({ error: "Secret name is required." });
      }

      const deleted = deleteSecret(name);
      if (deleted) {
        return JSON.stringify({
          success: true,
          message: `Secret "${name}" deleted.`,
        });
      }
      return JSON.stringify({ error: `No secret found with name "${name}".` });
    },
  });
}
