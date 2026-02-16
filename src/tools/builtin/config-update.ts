import { registerTool } from "../registry";
import { loadConfig, saveConfig } from "../../config/loader";
import { logger } from "../../util/logger";

/**
 * Tool that lets the agent read and modify its own config.json at runtime.
 * Used when the user asks to switch providers, enable channels, set budgets, etc.
 */
export function registerConfigUpdateTool() {
  registerTool({
    definition: {
      name: "config_update",
      description:
        'Read or update Zubo\'s own configuration at runtime. Use action "get" to read current config, or "set" to change a value. Supports dot-notation paths like "activeProvider", "budget.dailyLimitUsd", "smartRouting.enabled". Changes take effect on next restart for most settings, but some (like activeProvider) may apply immediately. NEVER use this to store secrets — use secret_set for API keys and tokens.',
      input_schema: {
        type: "object",
        properties: {
          action: {
            type: "string",
            enum: ["get", "set"],
            description: 'Action to perform: "get" reads config, "set" updates a value.',
          },
          key: {
            type: "string",
            description:
              'Dot-notation config path to read or write. Examples: "activeProvider", "budget.dailyLimitUsd", "smartRouting.enabled", "agentName". For "get" without a key, returns the full config summary.',
          },
          value: {
            type: ["string", "number", "boolean"],
            description: "The new value to set. Required for action=set.",
          },
        },
        required: ["action"],
      },
    },
    execute: async (input) => {
      const { action, key, value } = input as {
        action: string;
        key?: string;
        value?: string | number | boolean;
      };

      if (action === "get") {
        const config = await loadConfig();
        if (!key) {
          // Return a safe summary (no secrets)
          return JSON.stringify({
            agentName: config.agentName,
            activeProvider: config.activeProvider,
            providers: config.providers
              ? Object.fromEntries(
                  Object.entries(config.providers).map(([name, p]) => [
                    name,
                    { model: p.model, hasApiKey: !!p.apiKey },
                  ])
                )
              : {},
            failover: config.failover ?? [],
            channels: config.channels
              ? Object.fromEntries(
                  Object.entries(config.channels).map(([name, c]) => [
                    name,
                    { enabled: (c as any)?.enabled ?? true },
                  ])
                )
              : {},
            smartRouting: config.smartRouting ?? { enabled: false },
            budget: config.budget ?? {},
            maxTurns: config.maxTurns,
            heartbeatMinutes: config.heartbeatMinutes,
          });
        }

        // Read a specific key via dot-notation
        const val = getNestedValue(config as Record<string, unknown>, key);
        if (val === undefined) {
          return `Config key "${key}" is not set.`;
        }
        // Mask API keys
        if (key.toLowerCase().includes("apikey") || key.toLowerCase().includes("token") || key.toLowerCase().includes("secret")) {
          return `Config key "${key}" is set (value hidden for security).`;
        }
        return JSON.stringify({ key, value: val });
      }

      if (action === "set") {
        if (!key) {
          return "Error: key is required for action=set.";
        }
        if (value === undefined) {
          return "Error: value is required for action=set.";
        }

        // Block setting secrets through config
        const lowerKey = key.toLowerCase();
        if (lowerKey.includes("apikey") || lowerKey.includes("password") || lowerKey.includes("secret") || lowerKey.includes("token")) {
          return "Error: Do not store secrets in config. Use secret_set to securely store API keys, tokens, and passwords.";
        }

        // Block modifying security-critical settings
        if (lowerKey.startsWith("sandbox") || lowerKey.startsWith("auth.")) {
          return "Error: Security settings (sandbox, auth) cannot be changed through the agent. Edit config.json manually.";
        }

        const config = await loadConfig();
        const configObj = config as Record<string, unknown>;

        setNestedValue(configObj, key, value);

        // Re-validate through schema
        const { configSchema } = await import("../../config/schema");
        try {
          const validated = configSchema.parse(configObj);
          await saveConfig(validated);
          logger.info(`Config updated: ${key} = ${JSON.stringify(value)}`);

          // Hot-swap LLM provider if activeProvider changed
          if (key === "activeProvider") {
            try {
              const { createProvider } = await import("../../llm/factory");
              const newLlm = await createProvider(validated);
              const router = (globalThis as any).__zuboRouter;
              if (router?.setLlm) {
                router.setLlm(newLlm);
                return `Switched to ${value}. Active now — no restart needed.`;
              }
            } catch (swapErr: any) {
              logger.warn("Provider hot-swap failed", { error: swapErr.message });
              return `Config updated: activeProvider = ${JSON.stringify(value)}, but hot-swap failed: ${swapErr.message}. Restart to apply.`;
            }
          }

          return `Config updated: ${key} = ${JSON.stringify(value)}.`;
        } catch (err: any) {
          return `Error: Invalid config value. ${err.message}`;
        }
      }

      return `Unknown action: ${action}. Use "get" or "set".`;
    },
  });
}

function getNestedValue(obj: Record<string, unknown>, path: string): unknown {
  const parts = path.split(".");
  let current: unknown = obj;
  for (const part of parts) {
    if (current == null || typeof current !== "object") return undefined;
    current = (current as Record<string, unknown>)[part];
  }
  return current;
}

function setNestedValue(obj: Record<string, unknown>, path: string, value: unknown): void {
  const parts = path.split(".");
  let current: Record<string, unknown> = obj;
  for (let i = 0; i < parts.length - 1; i++) {
    const part = parts[i];
    if (current[part] == null || typeof current[part] !== "object") {
      current[part] = {};
    }
    current = current[part] as Record<string, unknown>;
  }
  current[parts[parts.length - 1]] = value;
}
