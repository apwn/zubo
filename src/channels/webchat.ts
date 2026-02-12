import type { ChannelAdapter, InboundMessage } from "./adapter";
import type { MessageRouter } from "./router";
import { logger } from "../util/logger";

const WEBCHAT_HTML = `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>Orba</title>
<style>
  * { margin: 0; padding: 0; box-sizing: border-box; }
  body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; background: #0a0a0a; color: #e0e0e0; height: 100vh; display: flex; flex-direction: column; }
  #header { padding: 12px 16px; background: #141414; border-bottom: 1px solid #222; font-size: 14px; font-weight: 600; color: #888; }
  #messages { flex: 1; overflow-y: auto; padding: 16px; display: flex; flex-direction: column; gap: 12px; }
  .msg { max-width: 75%; padding: 10px 14px; border-radius: 12px; font-size: 14px; line-height: 1.5; white-space: pre-wrap; word-wrap: break-word; }
  .msg.user { align-self: flex-end; background: #2563eb; color: white; border-bottom-right-radius: 4px; }
  .msg.bot { align-self: flex-start; background: #1e1e1e; border: 1px solid #333; border-bottom-left-radius: 4px; }
  .msg.bot.thinking { opacity: 0.5; }
  #input-bar { padding: 12px 16px; background: #141414; border-top: 1px solid #222; display: flex; gap: 8px; }
  #input { flex: 1; padding: 10px 14px; background: #1e1e1e; border: 1px solid #333; border-radius: 8px; color: #e0e0e0; font-size: 14px; outline: none; }
  #input:focus { border-color: #2563eb; }
  #send { padding: 10px 20px; background: #2563eb; color: white; border: none; border-radius: 8px; font-size: 14px; cursor: pointer; }
  #send:hover { background: #1d4ed8; }
  #send:disabled { opacity: 0.5; cursor: default; }
</style>
</head>
<body>
<div id="header">Orba</div>
<div id="messages"></div>
<div id="input-bar">
  <input id="input" type="text" placeholder="Message Orba..." autocomplete="off">
  <button id="send">Send</button>
</div>
<script>
const messages = document.getElementById('messages');
const input = document.getElementById('input');
const send = document.getElementById('send');
let busy = false;

function addMsg(text, cls) {
  const d = document.createElement('div');
  d.className = 'msg ' + cls;
  d.textContent = text;
  messages.appendChild(d);
  messages.scrollTop = messages.scrollHeight;
  return d;
}

async function sendMessage() {
  const text = input.value.trim();
  if (!text || busy) return;
  busy = true;
  send.disabled = true;
  input.value = '';
  addMsg(text, 'user');
  const thinking = addMsg('Thinking...', 'bot thinking');
  try {
    const res = await fetch('/api/chat', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ message: text }),
    });
    const data = await res.json();
    thinking.remove();
    addMsg(data.reply || 'No response.', 'bot');
  } catch (e) {
    thinking.remove();
    addMsg('Error: ' + e.message, 'bot');
  }
  busy = false;
  send.disabled = false;
  input.focus();
}

send.addEventListener('click', sendMessage);
input.addEventListener('keydown', e => { if (e.key === 'Enter') sendMessage(); });
input.focus();
</script>
</body>
</html>`;

export function createWebChatAdapter(
  port: number,
  router: MessageRouter
): ChannelAdapter {
  let server: ReturnType<typeof Bun.serve> | null = null;
  const sessionKey = "webchat:local";

  return {
    channelName: "webchat",

    start() {
      server = Bun.serve({
        port,
        async fetch(req) {
          const url = new URL(req.url);

          // Serve chat UI
          if (url.pathname === "/" || url.pathname === "/index.html") {
            return new Response(WEBCHAT_HTML, {
              headers: { "Content-Type": "text/html" },
            });
          }

          // Chat API
          if (url.pathname === "/api/chat" && req.method === "POST") {
            try {
              const body = (await req.json()) as { message?: string };
              const text = body.message?.trim();
              if (!text) {
                return Response.json({ error: "No message" }, { status: 400 });
              }

              const message: InboundMessage = {
                channel: "webchat",
                userId: "local",
                sessionKey,
                text,
              };

              let reply = "";
              await router.handleMessage(message, async (r) => {
                reply = r;
              });

              return Response.json({ reply });
            } catch (err: any) {
              return Response.json(
                { error: err.message },
                { status: 500 }
              );
            }
          }

          return new Response("Not Found", { status: 404 });
        },
      });

      logger.info(`WebChat running at http://localhost:${port}`);
    },

    stop() {
      if (server) {
        server.stop();
        server = null;
      }
    },

    async sendMessage(_sessionKey: string, text: string) {
      // WebChat is pull-based (HTTP), no push mechanism for now.
      // Proactive messages are logged but not delivered until user polls.
      logger.debug("WebChat proactive message (not delivered)", {
        text: text.slice(0, 100),
      });
    },
  };
}
