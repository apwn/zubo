import {
  Client,
  GatewayIntentBits,
  type Message as DiscordMessage,
} from "discord.js";
import type { ChannelAdapter, InboundMessage } from "./adapter";
import type { MessageRouter } from "./router";
import { logger } from "../util/logger";

export function createDiscordAdapter(
  token: string,
  allowedUsers: string[],
  router: MessageRouter
): ChannelAdapter {
  const client = new Client({
    intents: [
      GatewayIntentBits.Guilds,
      GatewayIntentBits.GuildMessages,
      GatewayIntentBits.DirectMessages,
      GatewayIntentBits.MessageContent,
    ],
  });

  // Map session keys to channel IDs for proactive messaging
  const channelIds = new Map<string, string>();

  client.on("messageCreate", async (msg: DiscordMessage) => {
    // Ignore bots
    if (msg.author.bot) return;

    const isDM = !msg.guild;
    const isMentioned =
      msg.mentions.users.has(client.user?.id ?? "") ||
      msg.content.startsWith(`<@${client.user?.id}>`);

    // In guilds, only respond when mentioned
    if (!isDM && !isMentioned) return;

    const userId = msg.author.id;

    // Auto-pair: first user to DM gets registered
    if (allowedUsers.length === 0 && isDM) {
      allowedUsers.push(userId);
      logger.info(`Auto-registered Discord user: ${userId}`);
      await msg.reply(
        "Welcome! You've been registered as the owner of this Zubo agent."
      );
    }

    // Access control (skip for guild mentions if no allowlist)
    if (allowedUsers.length > 0 && !allowedUsers.includes(userId)) {
      if (isDM) {
        await msg.reply("Sorry, you're not authorized to use this bot.");
      }
      return;
    }

    const sessionKey = `discord:${userId}`;
    channelIds.set(sessionKey, msg.channel.id);

    // Strip the mention from the message text
    let text = msg.content;
    if (isMentioned && !isDM) {
      text = text
        .replace(new RegExp(`<@!?${client.user?.id}>`, "g"), "")
        .trim();
    }
    if (!text) return;

    const message: InboundMessage = {
      channel: "discord",
      userId,
      sessionKey,
      text,
    };

    // Show typing
    if ("sendTyping" in msg.channel) {
      await msg.channel.sendTyping().catch(() => {});
    }

    await router.handleMessage(message, async (replyText: string) => {
      const chunks = splitMessage(replyText, 1900);
      for (const chunk of chunks) {
        await msg.reply(chunk).catch(async () => {
          // If reply fails, try channel.send
          if ("send" in msg.channel) {
            await (msg.channel as any).send(chunk).catch((err: any) => {
              logger.error("Discord send failed", { error: err.message });
            });
          }
        });
      }
    });
  });

  client.on("error", (err) => {
    logger.error("Discord client error", { error: err.message });
  });

  return {
    channelName: "discord",

    start() {
      client.login(token).then(() => {
        logger.info(`Discord bot ${client.user?.tag} started`);
      });
    },

    stop() {
      client.destroy();
    },

    async sendMessage(sessionKey: string, text: string) {
      const channelId = channelIds.get(sessionKey);
      if (!channelId) {
        logger.warn("No Discord channel ID for session", { sessionKey });
        return;
      }
      try {
        const channel = await client.channels.fetch(channelId);
        if (channel && "send" in channel) {
          const chunks = splitMessage(text, 1900);
          for (const chunk of chunks) {
            await (channel as any).send(chunk);
          }
        }
      } catch (err: any) {
        logger.error("Discord proactive send failed", { error: err.message });
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
    let splitIdx = remaining.lastIndexOf("\n", maxLen);
    if (splitIdx === -1 || splitIdx < maxLen / 2) {
      splitIdx = maxLen;
    }
    chunks.push(remaining.slice(0, splitIdx));
    remaining = remaining.slice(splitIdx).replace(/^\n/, "");
  }
  return chunks;
}
