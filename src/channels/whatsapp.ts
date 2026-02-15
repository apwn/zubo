import type { ChannelAdapter, InboundMessage } from "./adapter";
import type { MessageRouter } from "./router";
import { splitMessage } from "./utils";
import { logger } from "../util/logger";
import { join } from "path";
import { paths } from "../config/paths";

export function createWhatsAppAdapter(
  allowedNumbers: string[],
  authDir: string | undefined,
  router: MessageRouter
): ChannelAdapter {
  let sock: any = null;
  const sessionDir = authDir ?? join(paths.root, "whatsapp-auth");

  const adapter: ChannelAdapter = {
    channelName: "whatsapp",

    start() {
      import("@whiskeysockets/baileys").then(async (baileys) => {
        const { default: makeWASocket, useMultiFileAuthState, DisconnectReason } = baileys;
        const { mkdirSync } = await import("fs");
        mkdirSync(sessionDir, { recursive: true });

        const { state, saveCreds } = await useMultiFileAuthState(sessionDir);

        sock = makeWASocket({
          auth: state,
          printQRInTerminal: true,
        });

        sock.ev.on("creds.update", saveCreds);

        sock.ev.on("connection.update", (update: any) => {
          const { connection, lastDisconnect, qr } = update;
          if (qr) {
            logger.info("WhatsApp QR code displayed in terminal — scan to connect");
          }
          if (connection === "close") {
            const shouldReconnect =
              lastDisconnect?.error?.output?.statusCode !== DisconnectReason.loggedOut;
            if (shouldReconnect) {
              logger.info("WhatsApp reconnecting in 3s...");
              sock = null;
              setTimeout(() => adapter.start(), 3000);
            } else {
              logger.info("WhatsApp logged out — not reconnecting");
            }
          } else if (connection === "open") {
            logger.info("WhatsApp connected");
          }
        });

        sock.ev.on("messages.upsert", async ({ messages }: any) => {
          for (const msg of messages) {
            if (!msg.message || msg.key.fromMe) continue;
            const jid = msg.key.remoteJid;
            if (!jid || jid.endsWith("@g.us")) continue; // Skip groups

            const number = jid.replace("@s.whatsapp.net", "");

            // Auto-pair
            if (allowedNumbers.length === 0) {
              allowedNumbers.push(number);
              logger.info(`Auto-registered WhatsApp number: ${number}`);
              await sock.sendMessage(jid, { text: "Welcome! You've been registered as the owner." });
            }

            if (allowedNumbers.length > 0 && !allowedNumbers.includes(number)) continue;

            const text =
              msg.message.conversation ||
              msg.message.extendedTextMessage?.text ||
              "";
            if (!text) continue;

            const sessionKey = `whatsapp:${number}`;
            const inbound: InboundMessage = {
              channel: "whatsapp",
              userId: number,
              sessionKey,
              text,
            };

            // Show composing indicator
            await sock.sendPresenceUpdate("composing", jid);

            await router.handleMessage(inbound, async (reply) => {
              await sock.sendPresenceUpdate("paused", jid);
              const chunks = splitMessage(reply, 4000);
              for (const chunk of chunks) {
                await sock.sendMessage(jid, { text: chunk });
              }
            });
          }
        });
      }).catch((err: any) => {
        logger.error("Failed to start WhatsApp — install @whiskeysockets/baileys", { error: err.message });
      });
    },

    stop() {
      if (sock) {
        sock.end();
        sock = null;
      }
    },

    async sendMessage(sessionKey: string, text: string) {
      if (!sock) return;
      const number = sessionKey.split(":")[1];
      if (!number) return;
      const jid = `${number}@s.whatsapp.net`;
      const chunks = splitMessage(text, 4000);
      for (const chunk of chunks) {
        await sock.sendMessage(jid, { text: chunk }).catch((err: any) => {
          logger.error("WhatsApp send failed", { error: err.message });
        });
      }
    },
  };

  return adapter;
}
