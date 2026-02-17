import type { LlmProvider } from "../llm/provider";
import type { InboundMessage, ChannelAdapter } from "./adapter";
import { agentLoop, agentLoopStream, type StreamCallbacks } from "../agent/loop";
import { searchMemory, searchMemoryAsync } from "../memory/engine";
import { logger } from "../util/logger";
import { recordError } from "../util/error-buffer";
import { Database } from "bun:sqlite";
import { getAllTools } from "../tools/registry";
import { getToolPermission, getToolScopes } from "../tools/permissions";
import { paths } from "../config/paths";
import { readFileSync, statSync, writeFileSync } from "fs";

function parseCommand(text: string): { name: string; args: string } | null {
  const trimmed = text.trim();
  if (!trimmed.startsWith("/")) return null;
  const [rawName, ...rest] = trimmed.slice(1).split(/\s+/);
  if (!rawName) return null;
  return { name: rawName.toLowerCase(), args: rest.join(" ").trim() };
}

function getMemoryRetrievalSettings(): { contextTopK: number; minConfidence: number } {
  if (!(getMemoryRetrievalSettings as any)._cache) {
    (getMemoryRetrievalSettings as any)._cache = {
      mtimeMs: -1,
      value: { contextTopK: 3, minConfidence: 0 },
    };
  }
  const cache = (getMemoryRetrievalSettings as any)._cache as {
    mtimeMs: number;
    value: { contextTopK: number; minConfidence: number };
  };
  try {
    const mtimeMs = statSync(paths.config).mtimeMs;
    if (cache.mtimeMs === mtimeMs) return cache.value;
    const raw = JSON.parse(readFileSync(paths.config, "utf-8"));
    const topK = Math.max(1, Math.min(10, Number(raw?.memoryRetrieval?.contextTopK ?? 3)));
    const minConfidence = Math.max(0, Math.min(1, Number(raw?.memoryRetrieval?.minConfidence ?? 0)));
    cache.mtimeMs = mtimeMs;
    cache.value = { contextTopK: topK, minConfidence };
    return cache.value;
  } catch {
    return cache.value;
  }
}

async function buildMemoryContext(db: Database, text: string): Promise<string> {
  const { contextTopK, minConfidence } = getMemoryRetrievalSettings();
  const results = await searchMemoryAsync(db, text, contextTopK);
  const filtered = results.filter((r) => (r.confidence ?? r.score ?? 0) >= minConfidence);
  return filtered.map((r) => r.content).join("\n\n");
}

function formatMemoryMatches(results: Array<{ content: string; confidence?: number; matchType?: string; reasons?: string[] }>): string {
  return results
    .map((r, i) => {
      const confidence = typeof r.confidence === "number" ? `${Math.round(r.confidence * 100)}%` : "n/a";
      const matchType = r.matchType ?? "fts";
      const reasons = r.reasons?.length ? r.reasons.join(", ") : "keyword match";
      return `[${i + 1}] (${matchType}, confidence ${confidence}, ${reasons}) ${r.content}`;
    })
    .join("\n\n");
}

function loadRawConfig(): any {
  try {
    return JSON.parse(readFileSync(paths.config, "utf-8"));
  } catch {
    return {};
  }
}

function saveRawConfig(config: any): void {
  writeFileSync(paths.config, JSON.stringify(config, null, 2) + "\n");
}

async function switchModelRuntime(provider: string, model: string): Promise<{ ok: boolean; message: string; provider?: LlmProvider }> {
  try {
    if (!provider || !model) {
      return { ok: false, message: "Usage: /model set <provider/model>" };
    }
    const config = loadRawConfig();
    if (!config.providers || !config.providers[provider]) {
      return { ok: false, message: `Provider '${provider}' is not configured.` };
    }
    config.activeProvider = provider;
    config.providers[provider].model = model;
    config.model = model;
    await saveRawConfig(config);
    const { configSchema } = await import("../config/schema");
    const { createProvider } = await import("../llm/factory");
    const parsed = configSchema.parse(config);
    const next = await createProvider(parsed);
    return { ok: true, message: `Model switched to ${provider}/${model}`, provider: next };
  } catch (err: any) {
    return { ok: false, message: `Failed to switch model: ${err.message}` };
  }
}

async function setToolPermission(toolName: string, level: string): Promise<{ ok: boolean; message: string }> {
  if (!toolName || !level) return { ok: false, message: "Usage: /permissions set <tool> <auto|confirm|deny>" };
  if (!["auto", "confirm", "deny"].includes(level)) {
    return { ok: false, message: "Permission must be one of: auto, confirm, deny." };
  }
  const config = loadRawConfig();
  if (!config.toolPermissions) config.toolPermissions = {};
  config.toolPermissions[toolName] = level;
  await saveRawConfig(config);
  return { ok: true, message: `Permission updated: ${toolName} -> ${level}` };
}

function setBudgetPaused(db: Database, paused: boolean): { ok: boolean; message: string } {
  try {
    const row = db.query("SELECT id FROM budget_config WHERE id = 1").get() as { id: number } | null;
    if (!row) return { ok: false, message: "Budget is not configured." };
    db.prepare("UPDATE budget_config SET paused = ? WHERE id = 1").run(paused ? 1 : 0);
    invalidateBudgetCache();
    return { ok: true, message: paused ? "Budget paused." : "Budget resumed." };
  } catch (err: any) {
    return { ok: false, message: `Failed to update budget: ${err.message}` };
  }
}

const budgetCache = {
  checkedAtMs: 0,
  result: null as string | null,
};

function invalidateBudgetCache(): void {
  budgetCache.checkedAtMs = 0;
  budgetCache.result = null;
}

/** Check if budget has been exceeded. Returns an error message if paused, null if OK. */
function checkBudget(db: Database): string | null {
  const nowMs = Date.now();
  if (nowMs - budgetCache.checkedAtMs < 5000) {
    return budgetCache.result;
  }

  let result: string | null = null;
  try {
    const config = db.query("SELECT daily_limit_usd, monthly_limit_usd, paused FROM budget_config WHERE id = 1").get() as {
      daily_limit_usd: number | null;
      monthly_limit_usd: number | null;
      paused: number;
    } | null;
    if (!config) {
      result = null;
    } else if (config.paused) {
      result = "Budget exceeded — agent is paused. Adjust your budget limits in the dashboard to resume.";
    } else {

      if (config.daily_limit_usd) {
        const daily = db.query(
          "SELECT COALESCE(SUM(cost_usd), 0) as total FROM usage WHERE created_at >= datetime('now', 'start of day') AND cost_usd IS NOT NULL"
        ).get() as { total: number };
        if (daily.total >= config.daily_limit_usd) {
          db.run("UPDATE budget_config SET paused = 1 WHERE id = 1");
          result = `Daily budget limit ($${config.daily_limit_usd.toFixed(2)}) reached. Agent paused.`;
        }
      }

      if (!result && config.monthly_limit_usd) {
        const monthly = db.query(
          "SELECT COALESCE(SUM(cost_usd), 0) as total FROM usage WHERE created_at >= datetime('now', 'start of month') AND cost_usd IS NOT NULL"
        ).get() as { total: number };
        if (monthly.total >= config.monthly_limit_usd) {
          db.run("UPDATE budget_config SET paused = 1 WHERE id = 1");
          result = `Monthly budget limit ($${config.monthly_limit_usd.toFixed(2)}) reached. Agent paused.`;
        }
      }
    }
  } catch {
    // Budget table may not exist yet — allow through
  }
  budgetCache.checkedAtMs = nowMs;
  budgetCache.result = result;
  return result;
}

/** All channels share one session file since Zubo is a single-owner agent. */
const UNIFIED_SESSION = "owner";

export interface MessageRouter {
  handleMessage(
    message: InboundMessage,
    reply: (text: string) => Promise<void>
  ): Promise<void>;
  handleMessageStream?(
    message: InboundMessage,
    onDelta: (text: string) => void,
    onToolStart?: (name: string) => void,
    onToolEnd?: (name: string) => void,
  ): Promise<string>;
  sendProactive(sessionKey: string, task: string): Promise<string>;
  broadcastProactive?(message: string): Promise<void>;
  addAdapter(adapter: ChannelAdapter): void;
  removeAdapter(channelName: string): void;
  getAdapterNames(): string[];
  setLlm(provider: LlmProvider): void;
  /** @deprecated Use addAdapter instead */
  setAdapter(adapter: ChannelAdapter): void;
  stopAll(): void;
}

export function createRouter(
  llm: LlmProvider,
  db: Database
): MessageRouter {
  let currentLlm = llm;
  const adapters = new Map<string, ChannelAdapter>();

  function getAdapterForSession(sessionKey: string): ChannelAdapter | null {
    const channel = sessionKey.split(":")[0];
    return adapters.get(channel) ?? null;
  }

  return {
    addAdapter(adapter: ChannelAdapter) {
      adapters.set(adapter.channelName, adapter);
    },

    removeAdapter(channelName: string) {
      const adapter = adapters.get(channelName);
      if (adapter) {
        adapter.stop();
        adapters.delete(channelName);
      }
    },

    getAdapterNames(): string[] {
      return Array.from(adapters.keys());
    },

    setLlm(provider: LlmProvider) {
      currentLlm = provider;
      logger.info(`LLM provider hot-swapped to ${provider.providerName}/${provider.model}`);
    },

    // Backward compat
    setAdapter(adapter: ChannelAdapter) {
      adapters.set(adapter.channelName, adapter);
    },

    stopAll() {
      for (const adapter of adapters.values()) {
        adapter.stop();
      }
    },

    async handleMessage(message, reply) {
      const { sessionKey, text } = message;

      logger.info(`Message from ${message.channel}:${message.userId}`, {
        sessionKey,
      });

      // Budget enforcement
      const budgetError = checkBudget(db);
      if (budgetError) {
        await reply(budgetError);
        return;
      }

      try {
        const command = parseCommand(text);
        if (command) {
          if (command.name === "help") {
            await reply(
              "Commands:\n" +
              "/help — show commands\n" +
              "/status — runtime status\n" +
              "/memory <query> — search saved memory\n" +
              "/model — show current model\n" +
              "/model set <provider/model> — switch model\n" +
              "/tools [filter] — list tools\n" +
              "/permissions <tool> — tool permissions\n" +
              "/permissions set <tool> <auto|confirm|deny> — set permission\n" +
              "/budget — budget status\n" +
              "/budget pause|resume — control budget pause"
            );
            return;
          }
          if (command.name === "status") {
            const memoryCount = (db.query("SELECT COUNT(*) as c FROM memory_chunks").get() as { c: number } | null)?.c ?? 0;
            await reply(`Status: running\nProvider: ${currentLlm.providerName}/${currentLlm.model}\nMemory chunks: ${memoryCount}`);
            return;
          }
          if (command.name === "memory") {
            if (!command.args) {
              await reply("Usage: /memory <query>");
              return;
            }
            const results = searchMemory(db, command.args, 3);
            if (!results.length) {
              await reply("No relevant memories found.");
              return;
            }
            await reply(`Found ${results.length} memory matches:\n\n${formatMemoryMatches(results)}`);
            return;
          }
          if (command.name === "model") {
            if (command.args.startsWith("set ")) {
              const target = command.args.slice(4).trim();
              const [provider, ...modelParts] = target.split("/");
              const model = modelParts.join("/").trim();
              const switched = await switchModelRuntime(provider, model);
              if (switched.ok && switched.provider) {
                currentLlm = switched.provider;
              }
              await reply(switched.message);
              return;
            }
            await reply(`Current model: ${currentLlm.providerName}/${currentLlm.model}`);
            return;
          }
          if (command.name === "tools") {
            const filter = command.args.toLowerCase();
            const names = Array.from(getAllTools().keys())
              .filter((n) => !filter || n.includes(filter))
              .sort()
              .slice(0, 40);
            await reply(names.length ? `Available tools (${names.length} shown):\n${names.join(", ")}` : "No tools found.");
            return;
          }
          if (command.name === "permissions") {
            if (command.args.startsWith("set ")) {
              const parts = command.args.slice(4).trim().split(/\s+/);
              const toolName = parts[0] ?? "";
              const level = parts[1] ?? "";
              const result = await setToolPermission(toolName, level);
              await reply(result.message);
              return;
            }
            const toolName = command.args.trim();
            if (!toolName) {
              await reply("Usage: /permissions <tool_name>");
              return;
            }
            await reply(
              `Permissions for ${toolName}:\n` +
              `level: ${getToolPermission(toolName)}\n` +
              `scopes: ${getToolScopes(toolName).join(", ")}`
            );
            return;
          }
          if (command.name === "budget") {
            const arg = command.args.trim().toLowerCase();
            if (arg === "pause" || arg === "resume") {
              const result = setBudgetPaused(db, arg === "pause");
              await reply(result.message);
              return;
            }
            const row = db.query(
              "SELECT daily_limit_usd, monthly_limit_usd, paused, alert_threshold FROM budget_config WHERE id = 1"
            ).get() as { daily_limit_usd: number | null; monthly_limit_usd: number | null; paused: number; alert_threshold: number | null } | null;
            if (!row) {
              await reply("Budget: not configured.");
              return;
            }
            const daily = db.query(
              "SELECT COALESCE(SUM(cost_usd), 0) as total FROM usage WHERE created_at >= datetime('now', 'start of day') AND cost_usd IS NOT NULL"
            ).get() as { total: number };
            const monthly = db.query(
              "SELECT COALESCE(SUM(cost_usd), 0) as total FROM usage WHERE created_at >= datetime('now', 'start of month') AND cost_usd IS NOT NULL"
            ).get() as { total: number };
            await reply(
              `Budget status:\n` +
              `paused: ${row.paused ? "yes" : "no"}\n` +
              `daily: $${daily.total.toFixed(4)} / ${row.daily_limit_usd ? `$${row.daily_limit_usd.toFixed(2)}` : "unlimited"}\n` +
              `monthly: $${monthly.total.toFixed(4)} / ${row.monthly_limit_usd ? `$${row.monthly_limit_usd.toFixed(2)}` : "unlimited"}`
            );
            return;
          }
          await reply(`Unknown command: /${command.name}. Try /help.`);
          return;
        }

        // Search memory for relevant context
        let memories = "";
        try {
          memories = await buildMemoryContext(db, text);
        } catch (err: any) {
          if (!err.message?.includes("no such table")) {
            logger.warn("Memory search failed", { error: err.message });
          }
        }

        const result = await agentLoop(currentLlm, UNIFIED_SESSION, text, {
          memories,
          directUserRequest: true,
        });
        if (result.reply) {
          await reply(result.reply);
        }
      } catch (err: any) {
        logger.error("Agent loop error", { error: err.message });
        recordError("agent-loop", err.message);
        await reply("Sorry, I encountered an error. Please try again.");
      }
    },

    async handleMessageStream(message, onDelta, onToolStart?, onToolEnd?) {
      const { text } = message;

      logger.info(`Stream message from ${message.channel}:${message.userId}`);

      // Budget enforcement
      const budgetError = checkBudget(db);
      if (budgetError) {
        onDelta(budgetError);
        return budgetError;
      }

      const command = parseCommand(text);
      if (command) {
        if (command.name === "help") {
          const help =
            "Commands:\n" +
            "/help — show commands\n" +
            "/status — runtime status\n" +
            "/memory <query> — search saved memory\n" +
            "/model — show current model\n" +
            "/model set <provider/model> — switch model\n" +
            "/tools [filter] — list tools\n" +
            "/permissions <tool> — tool permissions\n" +
            "/permissions set <tool> <auto|confirm|deny> — set permission\n" +
            "/budget — budget status\n" +
            "/budget pause|resume — control budget pause";
          onDelta(help);
          return help;
        }
        if (command.name === "status") {
          const memoryCount = (db.query("SELECT COUNT(*) as c FROM memory_chunks").get() as { c: number } | null)?.c ?? 0;
          const status = `Status: running\nProvider: ${currentLlm.providerName}/${currentLlm.model}\nMemory chunks: ${memoryCount}`;
          onDelta(status);
          return status;
        }
        if (command.name === "memory") {
          if (!command.args) {
            const usage = "Usage: /memory <query>";
            onDelta(usage);
            return usage;
          }
          const results = searchMemory(db, command.args, 3);
          const textResult = results.length
            ? `Found ${results.length} memory matches:\n\n${formatMemoryMatches(results)}`
            : "No relevant memories found.";
          onDelta(textResult);
          return textResult;
        }
        if (command.name === "model") {
          if (command.args.startsWith("set ")) {
            const target = command.args.slice(4).trim();
            const [provider, ...modelParts] = target.split("/");
            const model = modelParts.join("/").trim();
            const switched = await switchModelRuntime(provider, model);
            if (switched.ok && switched.provider) currentLlm = switched.provider;
            onDelta(switched.message);
            return switched.message;
          }
          const response = `Current model: ${currentLlm.providerName}/${currentLlm.model}`;
          onDelta(response);
          return response;
        }
        if (command.name === "tools") {
          const filter = command.args.toLowerCase();
          const names = Array.from(getAllTools().keys())
            .filter((n) => !filter || n.includes(filter))
            .sort()
            .slice(0, 40);
          const response = names.length ? `Available tools (${names.length} shown):\n${names.join(", ")}` : "No tools found.";
          onDelta(response);
          return response;
        }
        if (command.name === "permissions") {
          if (command.args.startsWith("set ")) {
            const parts = command.args.slice(4).trim().split(/\s+/);
            const result = await setToolPermission(parts[0] ?? "", parts[1] ?? "");
            onDelta(result.message);
            return result.message;
          }
          const toolName = command.args.trim();
          const response = toolName
            ? `Permissions for ${toolName}:\nlevel: ${getToolPermission(toolName)}\nscopes: ${getToolScopes(toolName).join(", ")}`
            : "Usage: /permissions <tool_name>";
          onDelta(response);
          return response;
        }
        if (command.name === "budget") {
          const arg = command.args.trim().toLowerCase();
          if (arg === "pause" || arg === "resume") {
            const result = setBudgetPaused(db, arg === "pause");
            onDelta(result.message);
            return result.message;
          }
          const row = db.query(
            "SELECT daily_limit_usd, monthly_limit_usd, paused FROM budget_config WHERE id = 1"
          ).get() as { daily_limit_usd: number | null; monthly_limit_usd: number | null; paused: number } | null;
          const response = row
            ? `Budget configured. paused: ${row.paused ? "yes" : "no"}`
            : "Budget: not configured.";
          onDelta(response);
          return response;
        }
        const unknown = `Unknown command: /${command.name}. Try /help.`;
        onDelta(unknown);
        return unknown;
      }

      let memories = "";
      try {
        memories = await buildMemoryContext(db, text);
      } catch (err: any) {
        if (!err.message?.includes("no such table")) {
          logger.warn("Memory search failed", { error: err.message });
        }
      }

      return new Promise<string>((resolve, reject) => {
        agentLoopStream(
          currentLlm,
          UNIFIED_SESSION,
          text,
          {
            onTextDelta: onDelta,
            onToolStart: onToolStart ? (name) => onToolStart(name) : undefined,
            onToolEnd: onToolEnd ? (name) => onToolEnd(name) : undefined,
            onDone: (result) => resolve(result.reply),
            onError: (err) => reject(err),
          },
          {
            memories,
            directUserRequest: true,
          }
        );
      });
    },

    async sendProactive(sessionKey, task) {
      try {
        const result = await agentLoop(currentLlm, UNIFIED_SESSION, task, {
          directUserRequest: false,
        });
        const adapter = getAdapterForSession(sessionKey);
        if (adapter && result.reply) {
          await adapter.sendMessage(sessionKey, result.reply);
        }
        return result.reply;
      } catch (err: any) {
        logger.error("Proactive message error", { error: err.message });
        return "";
      }
    },

    async broadcastProactive(message) {
      for (const [name, adapter] of adapters) {
        try {
          // Use a generic session key for each channel
          await adapter.sendMessage(`${name}:owner`, message);
        } catch (err: any) {
          logger.warn(`Failed to broadcast to ${name}`, { error: err.message });
        }
      }
    },
  };
}
