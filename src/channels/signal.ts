import type { ChannelAdapter, InboundMessage } from "./adapter";
import type { MessageRouter } from "./router";
import { splitMessage } from "./utils";
import { logger } from "../util/logger";

export function createSignalAdapter(
  phoneNumber: string,
  allowedNumbers: string[],
  signalCliPath: string | undefined,
  router: MessageRouter
): ChannelAdapter {
  let proc: any = null;
  // Validate CLI path — reject shell metacharacters to prevent command injection
  const rawCliPath = signalCliPath ?? "signal-cli";
  if (/[;&|`$]/.test(rawCliPath)) {
    throw new Error("Invalid signal-cli path: shell metacharacters not allowed");
  }
  const cliPath = rawCliPath;

  return {
    channelName: "signal",

    start() {
      try {
        const child = Bun.spawn(
          [cliPath, "-u", phoneNumber, "jsonRpc"],
          {
            stdin: "pipe",
            stdout: "pipe",
            stderr: "pipe",
          }
        );
        proc = child;

        const reader = child.stdout.getReader();
        const decoder = new TextDecoder();
        let buffer = "";

        (async () => {
          try {
            while (true) {
              const { done, value } = await reader.read();
              if (done) break;
              buffer += decoder.decode(value, { stream: true });
              const lines = buffer.split("\n");
              buffer = lines.pop() ?? "";

              for (const line of lines) {
                if (!line.trim()) continue;
                try {
                  const msg = JSON.parse(line);
                  if (msg.method === "receive") {
                    const envelope = msg.params?.envelope;
                    if (!envelope?.dataMessage?.message) continue;

                    const sender = envelope.source;
                    const text = envelope.dataMessage.message;

                    // Auto-pair
                    if (allowedNumbers.length === 0) {
                      allowedNumbers.push(sender);
                      logger.info(`Auto-registered Signal number: ${sender}`);
                    }

                    if (allowedNumbers.length > 0 && !allowedNumbers.includes(sender)) continue;

                    const sessionKey = `signal:${sender}`;
                    const inbound: InboundMessage = {
                      channel: "signal",
                      userId: sender,
                      sessionKey,
                      text,
                    };

                    await router.handleMessage(inbound, async (reply) => {
                      const chunks = splitMessage(reply, 4000);
                      for (const chunk of chunks) {
                        sendSignalMessage(child, phoneNumber, sender, chunk);
                      }
                    });
                  }
                } catch (err: any) {
                  logger.warn("Failed to parse Signal message", { error: (err as Error).message });
                }
              }
            }
          } catch (err: any) {
            logger.error("Signal read error", { error: err.message });
          }
        })();

        logger.info("Signal adapter started via signal-cli JSON-RPC");
      } catch (err: any) {
        logger.error("Failed to start Signal adapter — ensure signal-cli is installed", { error: err.message });
      }
    },

    stop() {
      if (proc) {
        proc.kill();
        proc = null;
      }
    },

    async sendMessage(sessionKey: string, text: string) {
      if (!proc) return;
      const number = sessionKey.split(":")[1];
      if (!number) return;
      const chunks = splitMessage(text, 4000);
      for (const chunk of chunks) {
        sendSignalMessage(proc, phoneNumber, number, chunk);
      }
    },
  };
}

function sendSignalMessage(proc: any, from: string, to: string, text: string) {
  const rpcMsg = JSON.stringify({
    jsonrpc: "2.0",
    method: "send",
    id: Date.now().toString(),
    params: {
      recipient: [to],
      message: text,
    },
  }) + "\n";

  try {
    proc.stdin.write(rpcMsg);
  } catch (err: any) {
    logger.error("Signal send failed", { error: err.message });
  }
}
