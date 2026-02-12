import { existsSync, readFileSync, writeFileSync, readdirSync } from "fs";
import { join } from "path";
import type { ChannelAdapter, InboundMessage } from "./adapter";
import type { MessageRouter } from "./router";
import { paths } from "../config/paths";
import { logger } from "../util/logger";
import { DASHBOARD_HTML } from "./dashboard.html";
import { parseSkillMd } from "../tools/skill-loader";

const WEBCHAT_HTML = `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>Orba</title>
<style>
  * { margin: 0; padding: 0; box-sizing: border-box; }
  body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; background: #0a0a0a; color: #e0e0e0; height: 100vh; display: flex; flex-direction: column; }
  #header { padding: 12px 16px; background: #141414; border-bottom: 1px solid #222; font-size: 14px; font-weight: 600; color: #888; display: flex; justify-content: space-between; }
  #header a { color: #2563eb; text-decoration: none; font-size: 12px; }
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
<div id="header"><span>Orba</span><a href="/dashboard">Dashboard</a></div>
<div id="messages"></div>
<div id="input-bar">
  <input id="input" type="text" placeholder="Message Orba..." autocomplete="off">
  <button id="send">Send</button>
</div>
<script>
var messages = document.getElementById('messages');
var input = document.getElementById('input');
var send = document.getElementById('send');
var busy = false;

function addMsg(text, cls) {
  var d = document.createElement('div');
  d.className = 'msg ' + cls;
  d.textContent = text;
  messages.appendChild(d);
  messages.scrollTop = messages.scrollHeight;
  return d;
}

function sendMessage() {
  var text = input.value.trim();
  if (!text || busy) return;
  busy = true;
  send.disabled = true;
  input.value = '';
  addMsg(text, 'user');
  var thinking = addMsg('Thinking...', 'bot thinking');
  fetch('/api/chat', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ message: text }),
  }).then(function(r) { return r.json(); }).then(function(data) {
    thinking.remove();
    addMsg(data.reply || 'No response.', 'bot');
  }).catch(function(e) {
    thinking.remove();
    addMsg('Error: ' + e.message, 'bot');
  }).finally(function() {
    busy = false;
    send.disabled = false;
    input.focus();
  });
}

send.addEventListener('click', sendMessage);
input.addEventListener('keydown', function(e) { if (e.key === 'Enter') sendMessage(); });
input.focus();
</script>
</body>
</html>`;

// Dashboard API helpers
function readFileOr(path: string, fallback: string): string {
  try {
    if (existsSync(path)) return readFileSync(path, "utf-8");
  } catch {}
  return fallback;
}

function getStatusData(): Record<string, string> {
  const data: Record<string, string> = {};

  // Provider
  try {
    const config = JSON.parse(readFileSync(paths.config, "utf-8"));
    if (config.providers && config.activeProvider) {
      const p = config.providers[config.activeProvider];
      data["Provider"] = `${config.activeProvider}/${p?.model ?? "?"}`;
    } else if (config.anthropicApiKey) {
      data["Provider"] = `anthropic/${config.model ?? "claude-sonnet-4-5"}`;
    }
    // Channels
    const ch: string[] = [];
    if (config.channels?.telegram?.botToken || config.telegramBotToken) ch.push("telegram");
    if (config.channels?.discord?.botToken) ch.push("discord");
    if (config.channels?.webchat) ch.push("webchat");
    data["Channels"] = ch.join(", ") || "none";
  } catch {}

  // DB stats
  try {
    if (existsSync(paths.db)) {
      const { Database } = require("bun:sqlite");
      const db = new Database(paths.db, { readonly: true });
      const msgs = (db.query("SELECT COUNT(*) as c FROM messages").get() as any)?.c ?? 0;
      const mems = (db.query("SELECT COUNT(*) as c FROM memory_chunks").get() as any)?.c ?? 0;
      db.close();
      data["Messages"] = String(msgs);
      data["Memories"] = String(mems);
    }
  } catch {}

  // Daemon
  try {
    if (existsSync(paths.pidFile)) {
      const pid = parseInt(readFileSync(paths.pidFile, "utf-8").trim(), 10);
      process.kill(pid, 0);
      data["Status"] = "running";
    } else {
      data["Status"] = "running"; // if we're serving this, we're running
    }
  } catch {
    data["Status"] = "running";
  }

  return data;
}

function getCronJobs(): any[] {
  try {
    if (!existsSync(paths.db)) return [];
    const { Database } = require("bun:sqlite");
    const db = new Database(paths.db, { readonly: true });
    const jobs = db.query("SELECT * FROM cron_jobs ORDER BY id").all();
    db.close();
    return jobs as any[];
  } catch {
    return [];
  }
}

function searchMemoryChunks(query: string): any[] {
  try {
    if (!existsSync(paths.db)) return [];
    const { Database } = require("bun:sqlite");
    const db = new Database(paths.db, { readonly: true });
    const results = db
      .query(
        "SELECT mc.source_file as source, mc.content FROM memory_fts f JOIN memory_chunks mc ON mc.id = f.rowid WHERE memory_fts MATCH ? ORDER BY rank LIMIT 20"
      )
      .all(query);
    db.close();
    return results as any[];
  } catch {
    return [];
  }
}

function getSkillsData(): { name: string; description: string; status: string; path: string }[] {
  const skillsDir = paths.skills;
  const results: { name: string; description: string; status: string; path: string }[] = [];

  try {
    if (!existsSync(skillsDir)) return results;
    const entries = readdirSync(skillsDir) as string[];

    for (const entry of entries) {
      const dirPath = join(skillsDir, entry);
      const skillMdPath = join(dirPath, "SKILL.md");
      const handlerPath = join(dirPath, "handler.ts");

      if (!existsSync(skillMdPath)) continue;

      const mdContent = readFileSync(skillMdPath, "utf-8");
      const parsed = parseSkillMd(mdContent, dirPath);

      const hasHandler = existsSync(handlerPath);
      const status = parsed && hasHandler ? "ok" : "error";
      const name = parsed?.name ?? entry;
      const description = parsed?.description?.split("\n")[0].slice(0, 100) ?? "";

      results.push({ name, description, status, path: dirPath });
    }
  } catch {}

  return results;
}

function handleDashboardApi(url: URL, req: Request): Response | null {
  const path = url.pathname.replace("/api/dashboard", "");

  // GET /api/dashboard/status
  if (path === "/status" && req.method === "GET") {
    return Response.json(getStatusData());
  }

  // GET /api/dashboard/system
  if (path === "/system" && req.method === "GET") {
    return Response.json({
      content: readFileOr(paths.systemPrompt, ""),
    });
  }

  // PUT /api/dashboard/system
  if (path === "/system" && req.method === "PUT") {
    return (async () => {
      const body = (await req.json()) as { content?: string };
      writeFileSync(paths.systemPrompt, body.content ?? "");
      return Response.json({ ok: true });
    })() as any;
  }

  // GET /api/dashboard/memory
  if (path === "/memory" && req.method === "GET") {
    return Response.json({
      content: readFileOr(paths.memoryFile, ""),
    });
  }

  // PUT /api/dashboard/memory
  if (path === "/memory" && req.method === "PUT") {
    return (async () => {
      const body = (await req.json()) as { content?: string };
      writeFileSync(paths.memoryFile, body.content ?? "");
      return Response.json({ ok: true });
    })() as any;
  }

  // GET /api/dashboard/memory/search?q=...
  if (path === "/memory/search" && req.method === "GET") {
    const q = url.searchParams.get("q") ?? "";
    return Response.json({ results: searchMemoryChunks(q) });
  }

  // GET /api/dashboard/cron
  if (path === "/cron" && req.method === "GET") {
    return Response.json({ jobs: getCronJobs() });
  }

  // GET /api/dashboard/logs
  if (path === "/logs" && req.method === "GET") {
    const content = readFileOr(paths.logFile, "");
    const lines = content.trimEnd().split("\n");
    return Response.json({ content: lines.slice(-100).join("\n") });
  }

  // GET /api/dashboard/skills
  if (path === "/skills" && req.method === "GET") {
    return Response.json({ skills: getSkillsData() });
  }

  return null;
}

export interface WebChatAdapter extends ChannelAdapter {
  getPort(): number;
}

export function createWebChatAdapter(
  port: number,
  router: MessageRouter
): WebChatAdapter {
  let server: ReturnType<typeof Bun.serve> | null = null;
  const sessionKey = "webchat:local";

  return {
    channelName: "webchat",

    getPort() {
      return server?.port ?? port;
    },

    start() {
      server = Bun.serve({
        port,
        async fetch(req) {
          const url = new URL(req.url);

          // Chat UI
          if (url.pathname === "/" || url.pathname === "/index.html") {
            return new Response(WEBCHAT_HTML, {
              headers: { "Content-Type": "text/html" },
            });
          }

          // Dashboard UI
          if (url.pathname === "/dashboard") {
            return new Response(DASHBOARD_HTML, {
              headers: { "Content-Type": "text/html" },
            });
          }

          // Dashboard API
          if (url.pathname.startsWith("/api/dashboard")) {
            const result = handleDashboardApi(url, req);
            if (result) return result;
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

      logger.info(`WebChat + Dashboard at http://localhost:${server.port}`);
    },

    stop() {
      if (server) {
        server.stop();
        server = null;
      }
    },

    async sendMessage(_sessionKey: string, text: string) {
      logger.debug("WebChat proactive message (not delivered)", {
        text: text.slice(0, 100),
      });
    },
  };
}
