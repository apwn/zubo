import { Bot } from "grammy";
import type { ChannelAdapter, InboundMessage } from "./adapter";
import type { MessageRouter } from "./router";
import type { OrbaConfig } from "../config/schema";
import { saveConfig } from "../config/loader";
import { logger } from "../util/logger";

export function createTelegramAdapter(
  token: string,
  config: OrbaConfig,
  router: MessageRouter
): ChannelAdapter {
  const bot = new Bot(token);

  // Map chat IDs to reply functions for proactive messaging
  const chatIds = new Map<string, number>();

  bot.on("message:text", async (ctx) => {
    const userId = ctx.from.id;
    const chatId = ctx.chat.id;
    const text = ctx.message.text;

    // Auto-pair: first user to message gets registered
    if (config.telegramAllowedUsers.length === 0) {
      config.telegramAllowedUsers.push(userId);
      await saveConfig(config);
      logger.info(`Auto-registered Telegram user: ${userId}`);
      await ctx.reply(
        "Welcome! You've been registered as the owner of this Orba agent."
      );
    }

    // Access control
    if (!config.telegramAllowedUsers.includes(userId)) {
      await ctx.reply("Sorry, you're not authorized to use this bot.");
      return;
    }

    const sessionKey = `telegram:${userId}`;
    chatIds.set(sessionKey, chatId);

    const message: InboundMessage = {
      channel: "telegram",
      userId: String(userId),
      sessionKey,
      text,
    };

    // Show typing indicator
    await ctx.replyWithChatAction("typing");

    await router.handleMessage(message, async (replyText: string) => {
      // Split long messages (Telegram 4096 char limit)
      const chunks = splitMessage(replyText, 4000);
      for (const chunk of chunks) {
        await ctx.reply(chunk, { parse_mode: "Markdown" }).catch(async () => {
          // Fallback without markdown if parsing fails
          await ctx.reply(chunk);
        });
      }
    });
  });

  bot.catch((err) => {
    logger.error("Telegram bot error", { error: err.message });
  });

  return {
    start() {
      bot.start({
        onStart: (info) => {
          logger.info(`Telegram bot @${info.username} started`);
        },
      });
    },
    stop() {
      bot.stop();
    },
    async sendMessage(sessionKey: string, text: string) {
      const chatId = chatIds.get(sessionKey);
      if (chatId) {
        const chunks = splitMessage(text, 4000);
        for (const chunk of chunks) {
          await bot.api.sendMessage(chatId, chunk).catch(() => {});
        }
      }
    },
  };
}

function splitMessage(text: string, maxLen: number): string[] {
  if (text.length <= maxLen) return [text];
  const chunks: string[] = [];
  let remaining = text;
  while (remaining.length > 0) {
    if (remaining.length <= maxLen) {
      chunks.push(remaining);
      break;
    }
    // Try to split at a newline
    let splitIdx = remaining.lastIndexOf("\n", maxLen);
    if (splitIdx === -1 || splitIdx < maxLen / 2) {
      splitIdx = maxLen;
    }
    chunks.push(remaining.slice(0, splitIdx));
    remaining = remaining.slice(splitIdx).replace(/^\n/, "");
  }
  return chunks;
}
