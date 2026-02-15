import type { LlmProvider } from "../llm/provider";
import type { InboundMessage, ChannelAdapter } from "./adapter";
import { agentLoop, agentLoopStream, type StreamCallbacks } from "../agent/loop";
import { searchMemory } from "../memory/engine";
import { logger } from "../util/logger";
import { recordError } from "../util/error-buffer";
import { Database } from "bun:sqlite";

/** Check if budget has been exceeded. Returns an error message if paused, null if OK. */
function checkBudget(db: Database): string | null {
  try {
    const config = db.query("SELECT daily_limit_usd, monthly_limit_usd, paused FROM budget_config WHERE id = 1").get() as {
      daily_limit_usd: number | null;
      monthly_limit_usd: number | null;
      paused: number;
    } | null;
    if (!config) return null;
    if (config.paused) return "Budget exceeded — agent is paused. Adjust your budget limits in the dashboard to resume.";

    if (config.daily_limit_usd) {
      const daily = db.query(
        "SELECT COALESCE(SUM(cost_usd), 0) as total FROM usage WHERE date(created_at) = date('now') AND cost_usd IS NOT NULL"
      ).get() as { total: number };
      if (daily.total >= config.daily_limit_usd) {
        db.run("UPDATE budget_config SET paused = 1 WHERE id = 1");
        return `Daily budget limit ($${config.daily_limit_usd.toFixed(2)}) reached. Agent paused.`;
      }
    }

    if (config.monthly_limit_usd) {
      const monthly = db.query(
        "SELECT COALESCE(SUM(cost_usd), 0) as total FROM usage WHERE created_at >= datetime('now', 'start of month') AND cost_usd IS NOT NULL"
      ).get() as { total: number };
      if (monthly.total >= config.monthly_limit_usd) {
        db.run("UPDATE budget_config SET paused = 1 WHERE id = 1");
        return `Monthly budget limit ($${config.monthly_limit_usd.toFixed(2)}) reached. Agent paused.`;
      }
    }
  } catch {
    // Budget table may not exist yet — allow through
  }
  return null;
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
        // Search memory for relevant context
        let memories = "";
        try {
          const results = searchMemory(db, text, 3);
          if (results.length > 0) {
            memories = results.map((r) => r.content).join("\n\n");
          }
        } catch (err: any) {
          if (!err.message?.includes("no such table")) {
            logger.warn("Memory search failed", { error: err.message });
          }
        }

        const result = await agentLoop(currentLlm, UNIFIED_SESSION, text, memories);
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

      let memories = "";
      try {
        const results = searchMemory(db, text, 3);
        if (results.length > 0) {
          memories = results.map((r) => r.content).join("\n\n");
        }
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
          memories
        );
      });
    },

    async sendProactive(sessionKey, task) {
      try {
        const result = await agentLoop(currentLlm, UNIFIED_SESSION, task);
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
