import type { ChannelAdapter, InboundMessage } from "./adapter";
import type { MessageRouter } from "./router";
import { splitMessage } from "./utils";
import { logger } from "../util/logger";

export function createSlackAdapter(
  botToken: string,
  appToken: string,
  allowedUsers: string[],
  router: MessageRouter
): ChannelAdapter {
  let app: any = null;

  return {
    channelName: "slack",

    start() {
      import("@slack/bolt").then(({ App }) => {
        app = new App({
          token: botToken,
          appToken: appToken,
          socketMode: true,
        });

        app.message(async ({ message, say }: any) => {
          if (message.subtype) return;
          const userId = message.user;

          // Auto-pair first user
          if (allowedUsers.length === 0) {
            allowedUsers.push(userId);
            logger.info(`Auto-registered Slack user: ${userId}`);
            await say("Welcome! You've been registered as the owner of this Zubo agent.");
          }

          if (allowedUsers.length > 0 && !allowedUsers.includes(userId)) {
            return;
          }

          const sessionKey = `slack:${userId}`;
          const inbound: InboundMessage = {
            channel: "slack",
            userId,
            sessionKey,
            text: message.text || "",
          };

          await router.handleMessage(inbound, async (reply) => {
            const chunks = splitMessage(reply, 3000);
            for (const chunk of chunks) {
              await say(chunk);
            }
          });
        });

        app.event("app_mention", async ({ event, say }: any) => {
          const userId = event.user;
          if (allowedUsers.length > 0 && !allowedUsers.includes(userId)) return;

          const text = event.text.replace(/<@[^>]+>/g, "").trim();
          if (!text) return;

          const sessionKey = `slack:${userId}`;
          const inbound: InboundMessage = {
            channel: "slack",
            userId,
            sessionKey,
            text,
          };

          await router.handleMessage(inbound, async (reply) => {
            const chunks = splitMessage(reply, 3000);
            for (const chunk of chunks) {
              await say(chunk);
            }
          });
        });

        app.start().then(() => {
          logger.info("Slack adapter started (Socket Mode)");
        });
      }).catch((err: any) => {
        logger.error("Failed to start Slack adapter — install @slack/bolt", { error: err.message });
      });
    },

    stop() {
      if (app) {
        app.stop().catch(() => {});
        app = null;
      }
    },

    async sendMessage(sessionKey: string, text: string) {
      // For proactive messages we'd need channel IDs; skip for now
      logger.debug("Slack proactive message (not delivered via DM)", { text: text.slice(0, 100) });
    },
  };
}
