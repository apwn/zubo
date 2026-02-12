import { existsSync, readFileSync, writeFileSync, readdirSync } from "fs";
import { join } from "path";
import type { ChannelAdapter, InboundMessage } from "./adapter";
import type { MessageRouter } from "./router";
import { paths } from "../config/paths";
import { logger } from "../util/logger";
import { DASHBOARD_HTML } from "./dashboard.html";
import { parseSkillMd } from "../tools/skill-loader";

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

function getRecentMemoryChunks(): any[] {
  try {
    if (!existsSync(paths.db)) return [];
    const { Database } = require("bun:sqlite");
    const db = new Database(paths.db, { readonly: true });
    const results = db
      .query(
        "SELECT source_file as source, content FROM memory_chunks ORDER BY id DESC LIMIT 20"
      )
      .all();
    db.close();
    return results as any[];
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

function getConfigInfo(): {
  activeProvider: string;
  model: string;
  providers: { name: string; model: string }[];
} {
  try {
    const config = JSON.parse(readFileSync(paths.config, "utf-8"));
    const providers: { name: string; model: string }[] = [];

    if (config.providers) {
      for (const [name, p] of Object.entries(config.providers) as [string, any][]) {
        providers.push({ name, model: p.model ?? "" });
      }
    }

    let activeProvider = config.activeProvider ?? "";
    let model = "";

    if (config.providers && config.activeProvider) {
      const active = config.providers[config.activeProvider];
      model = active?.model ?? "";
    } else if (config.anthropicApiKey) {
      activeProvider = "anthropic";
      model = config.model ?? "claude-sonnet-4-5-20250929";
      // Include legacy provider in list if not already there
      if (!providers.find((p) => p.name === "anthropic")) {
        providers.push({ name: "anthropic", model });
      }
    }

    return { activeProvider, model, providers };
  } catch {
    return { activeProvider: "", model: "", providers: [] };
  }
}

function switchModelConfig(provider: string, model: string): { ok: boolean; error?: string } {
  try {
    if (!model) {
      return { ok: false, error: "Model is required" };
    }

    const config = JSON.parse(readFileSync(paths.config, "utf-8"));

    if (!config.providers) config.providers = {};

    if (!config.providers[provider]) {
      return { ok: false, error: `Provider "${provider}" is not configured. Add it via 'bun run setup' first.` };
    }

    config.activeProvider = provider;
    config.providers[provider].model = model;
    // Keep legacy field in sync
    config.model = model;

    writeFileSync(paths.config, JSON.stringify(config, null, 2) + "\n");
    return { ok: true };
  } catch (err: any) {
    return { ok: false, error: err.message };
  }
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

  // GET /api/dashboard/memory/recent
  if (path === "/memory/recent" && req.method === "GET") {
    return Response.json({ results: getRecentMemoryChunks() });
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

  // GET /api/dashboard/config
  if (path === "/config" && req.method === "GET") {
    return Response.json(getConfigInfo());
  }

  // PUT /api/dashboard/config/model — switch provider/model
  if (path === "/config/model" && req.method === "PUT") {
    return (async () => {
      const body = (await req.json()) as { provider?: string; model?: string };
      if (!body.provider) {
        return Response.json({ ok: false, error: "provider is required" }, { status: 400 });
      }
      const result = switchModelConfig(body.provider, body.model ?? "");
      return Response.json(result, { status: result.ok ? 200 : 400 });
    })() as any;
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

          // Unified UI (Agent chat + Dashboard)
          if (url.pathname === "/" || url.pathname === "/index.html") {
            return new Response(DASHBOARD_HTML, {
              headers: { "Content-Type": "text/html" },
            });
          }

          // Legacy /dashboard → redirect to #status
          if (url.pathname === "/dashboard") {
            return new Response(null, {
              status: 302,
              headers: { Location: "/#status" },
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
