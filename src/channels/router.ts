import type { LlmProvider } from "../llm/provider";
import type { InboundMessage, ChannelAdapter } from "./adapter";
import { agentLoop } from "../agent/loop";
import { searchMemory } from "../memory/engine";
import { logger } from "../util/logger";
import { Database } from "bun:sqlite";

export interface MessageRouter {
  handleMessage(
    message: InboundMessage,
    reply: (text: string) => Promise<void>
  ): Promise<void>;
  sendProactive(sessionKey: string, task: string): Promise<string>;
  addAdapter(adapter: ChannelAdapter): void;
  /** @deprecated Use addAdapter instead */
  setAdapter(adapter: ChannelAdapter): void;
  stopAll(): void;
}

export function createRouter(
  llm: LlmProvider,
  db: Database
): MessageRouter {
  const adapters = new Map<string, ChannelAdapter>();

  function getAdapterForSession(sessionKey: string): ChannelAdapter | null {
    const channel = sessionKey.split(":")[0];
    return adapters.get(channel) ?? null;
  }

  return {
    addAdapter(adapter: ChannelAdapter) {
      adapters.set(adapter.channelName, adapter);
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

        const result = await agentLoop(llm, sessionKey, text, memories);
        if (result.reply) {
          await reply(result.reply);
        }
      } catch (err: any) {
        logger.error("Agent loop error", { error: err.message });
        await reply("Sorry, I encountered an error. Please try again.");
      }
    },

    async sendProactive(sessionKey, task) {
      try {
        const result = await agentLoop(llm, sessionKey, task);
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
  };
}
