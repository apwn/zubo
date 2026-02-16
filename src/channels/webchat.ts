import { existsSync, readFileSync, writeFileSync, readdirSync, unlinkSync } from "fs";
import { join } from "path";
import type { ChannelAdapter, InboundMessage } from "./adapter";
import type { MessageRouter } from "./router";
import { paths } from "../config/paths";
import { getDb } from "../db/connection";
import { getHeartbeatMinutes, restartHeartbeat } from "../scheduler/heartbeat";
import { logger } from "../util/logger";
import { DASHBOARD_HTML } from "./dashboard.html";
import { parseSkillMd, parseSkillExport } from "../tools/skill-loader";
import { RateLimiter } from "../util/rate-limiter";
import { initAuth, validateRequest, createApiKey, listApiKeys, deleteApiKey, generateSessionToken } from "../util/auth";
import { exportDatabase, backupDatabase, importDatabase, getDbStats, getDbSizeBytes } from "../db/export";

/** Escape HTML to prevent XSS in OAuth error pages */
function escapeHtml(s: string): string {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;").replace(/'/g, "&#39;");
}

/** Add security headers to all HTTP responses */
function addSecurityHeaders(res: Response): Response {
  const headers = new Headers(res.headers);
  headers.set("X-Content-Type-Options", "nosniff");
  headers.set("X-Frame-Options", "DENY");
  headers.set("X-XSS-Protection", "1; mode=block");
  headers.set("Referrer-Policy", "strict-origin-when-cross-origin");
  headers.set("Permissions-Policy", "camera=(), microphone=(self), geolocation=()");
  // Only set CSP on HTML responses (don't break JSON APIs or SSE)
  if (headers.get("Content-Type")?.includes("text/html")) {
    headers.set("Content-Security-Policy", "default-src 'self'; script-src 'unsafe-inline'; style-src 'unsafe-inline' https://fonts.googleapis.com; font-src https://fonts.gstatic.com; img-src 'self' data:; connect-src 'self'; frame-ancestors 'none';");
  }
  return new Response(res.body, { status: res.status, statusText: res.statusText, headers });
}

// Dashboard API helpers
function readFileOr(path: string, fallback: string): string {
  try {
    if (existsSync(path)) return readFileSync(path, "utf-8");
  } catch (err: any) {
    logger.warn("Failed to read file", { path, error: (err as Error).message });
  }
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
  } catch (err: any) {
    logger.warn("Failed to read config for status data", { error: (err as Error).message });
  }

  // DB stats
  try {
    const db = getDb();
    let msgs = 0;
    try {
      const sessionFiles = readdirSync(paths.sessions).filter(f => f.endsWith(".jsonl"));
      for (const file of sessionFiles) {
        msgs += readFileSync(join(paths.sessions, file), "utf-8").trim().split("\n").filter(Boolean).length;
      }
    } catch {}
    const mems = (db.query("SELECT COUNT(*) as c FROM memory_chunks").get() as any)?.c ?? 0;
    data["Messages"] = String(msgs);
    data["Memories"] = String(mems);
  } catch (err: any) {
    logger.warn("Failed to read DB stats", { error: (err as Error).message });
  }

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
    const db = getDb();
    return db.query("SELECT * FROM cron_jobs ORDER BY id").all() as any[];
  } catch {
    return [];
  }
}

function getRecentMemoryChunks(): any[] {
  try {
    const db = getDb();
    return db
      .query(
        "SELECT source_file as source, content FROM memory_chunks ORDER BY id DESC LIMIT 20"
      )
      .all() as any[];
  } catch {
    return [];
  }
}

function searchMemoryChunks(query: string): any[] {
  try {
    // Sanitize FTS5 input — strip special operators to prevent query injection
    const sanitized = query.replace(/['"*()[\]{}:^~+\-!/\\]/g, " ").replace(/\b(AND|OR|NOT|NEAR)\b/gi, "").trim();
    const terms = sanitized.split(/\s+/).filter(Boolean);
    if (!terms.length) return [];
    const ftsQuery = terms.join(" OR ");
    const db = getDb();
    return db
      .query(
        "SELECT mc.source_file as source, mc.content FROM memory_fts f JOIN memory_chunks mc ON mc.id = f.rowid WHERE memory_fts MATCH ? ORDER BY rank LIMIT 20"
      )
      .all(ftsQuery) as any[];
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

      if (!existsSync(handlerPath)) continue;

      let parsed = null;
      if (existsSync(skillMdPath)) {
        const mdContent = readFileSync(skillMdPath, "utf-8");
        parsed = parseSkillMd(mdContent, dirPath);
      } else {
        // Try single-file format: check for exported skill config via regex
        try {
          const handlerContent = readFileSync(handlerPath, "utf-8");
          const nameMatch = handlerContent.match(/name\s*:\s*["']([^"']+)["']/);
          const descMatch = handlerContent.match(/description\s*:\s*["']([^"']+)["']/);
          if (nameMatch && descMatch) {
            parsed = { name: nameMatch[1], description: descMatch[1] };
          }
        } catch (err: any) {
          logger.warn("Failed to parse skill handler", { error: (err as Error).message });
        }
      }

      const status = parsed ? "ok" : "error";
      const name = parsed?.name ?? entry;
      const description = parsed?.description?.split("\n")[0].slice(0, 100) ?? "";

      results.push({ name, description, status, path: dirPath });
    }
  } catch (err: any) {
    logger.warn("Failed to read skills directory", { error: (err as Error).message });
  }

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
      return { ok: false, error: "Model name is required. Use the format: provider/model (e.g. anthropic/claude-sonnet-4-5-20250929)" };
    }

    const config = JSON.parse(readFileSync(paths.config, "utf-8"));

    if (!config.providers) config.providers = {};

    if (!config.providers[provider]) {
      return { ok: false, error: `Provider "${provider}" is not configured. Add it via 'zubo setup' first.` };
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

async function handleDashboardApi(url: URL, req: Request): Promise<Response | null> {
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
        return Response.json({ ok: false, error: "Provider name is required." }, { status: 400 });
      }
      const result = switchModelConfig(body.provider, body.model ?? "");
      return Response.json(result, { status: result.ok ? 200 : 400 });
    })() as any;
  }

  // GET /api/dashboard/settings/heartbeat
  if (path === "/settings/heartbeat" && req.method === "GET") {
    const minutes = getHeartbeatMinutes();
    // Also read saved value from config
    let configMinutes = 30;
    try {
      const config = JSON.parse(readFileSync(paths.config, "utf-8"));
      configMinutes = config.heartbeatMinutes ?? 30;
    } catch (err: any) {
      logger.warn("Failed to read heartbeat config", { error: (err as Error).message });
    }
    return Response.json({ minutes, configMinutes });
  }

  // PUT /api/dashboard/settings/heartbeat
  if (path === "/settings/heartbeat" && req.method === "PUT") {
    return (async () => {
      const body = (await req.json()) as { minutes?: number };
      const mins = body.minutes;
      if (!mins || typeof mins !== "number" || mins < 1 || mins > 1440) {
        return Response.json(
          { ok: false, error: "minutes must be between 1 and 1440" },
          { status: 400 }
        );
      }
      // Save to config
      try {
        const config = JSON.parse(readFileSync(paths.config, "utf-8"));
        config.heartbeatMinutes = mins;
        writeFileSync(paths.config, JSON.stringify(config, null, 2) + "\n");
      } catch (err: any) {
        return Response.json({ ok: false, error: "Failed to save config" }, { status: 500 });
      }
      // Apply immediately
      restartHeartbeat(mins);
      return Response.json({ ok: true, minutes: mins });
    })() as any;
  }

  // GET /api/dashboard/smart-routing
  if (path === "/smart-routing" && req.method === "GET") {
    try {
      const config = JSON.parse(readFileSync(paths.config, "utf-8"));
      return Response.json({
        enabled: config.smartRouting?.enabled ?? false,
        fastProvider: config.smartRouting?.fastProvider ?? "",
        fastModel: config.smartRouting?.fastModel ?? "",
      });
    } catch {
      return Response.json({ enabled: false, fastProvider: "", fastModel: "" });
    }
  }

  // PUT /api/dashboard/smart-routing
  if (path === "/smart-routing" && req.method === "PUT") {
    return (async () => {
      try {
        const body = (await req.json()) as {
          enabled?: boolean;
          fastProvider?: string;
          fastModel?: string;
        };
        const config = JSON.parse(readFileSync(paths.config, "utf-8"));
        if (!config.smartRouting) {
          config.smartRouting = {};
        }
        if (typeof body.enabled === "boolean") {
          config.smartRouting.enabled = body.enabled;
        }
        if (body.fastProvider !== undefined) {
          config.smartRouting.fastProvider = body.fastProvider;
        }
        if (body.fastModel !== undefined) {
          config.smartRouting.fastModel = body.fastModel;
        }
        writeFileSync(paths.config, JSON.stringify(config, null, 2) + "\n");
        return Response.json({ ok: true });
      } catch (err: any) {
        return Response.json({ ok: false, error: err.message }, { status: 500 });
      }
    })() as any;
  }

  // GET /api/dashboard/analytics/summary
  if (path === "/analytics/summary" && req.method === "GET") {
    try {
      const db = getDb();
      const summary = db.query(`
        SELECT
          COALESCE(SUM(input_tokens + output_tokens), 0) as totalTokens,
          COALESCE(SUM(cost_usd), 0) as totalCost,
          COALESCE(AVG(CASE WHEN response_time_ms IS NOT NULL THEN response_time_ms END), 0) as avgResponse,
          COUNT(DISTINCT session_id) as sessionCount
        FROM usage
      `).get() as any;
      return Response.json({
        totalTokens: summary.totalTokens,
        estimatedCostUsd: Math.round(summary.totalCost * 10000) / 10000,
        avgResponseTimeMs: Math.round(summary.avgResponse),
        sessionCount: summary.sessionCount,
      });
    } catch {
      return Response.json({ totalTokens: 0, estimatedCostUsd: 0, avgResponseTimeMs: 0, sessionCount: 0 });
    }
  }

  // GET /api/dashboard/analytics/usage-over-time
  if (path === "/analytics/usage-over-time" && req.method === "GET") {
    try {
      const db = getDb();
      const rows = db.query(
        `SELECT date(created_at) as day, SUM(input_tokens) as input, SUM(output_tokens) as output, COALESCE(SUM(cost_usd), 0) as cost
         FROM usage WHERE created_at >= datetime('now', '-7 days') GROUP BY day ORDER BY day`
      ).all();
      return Response.json({ days: rows });
    } catch {
      return Response.json({ days: [] });
    }
  }

  // GET /api/dashboard/analytics/tools
  if (path === "/analytics/tools" && req.method === "GET") {
    try {
      const db = getDb();
      const tools = db.query(
        `SELECT tool_name, COUNT(*) as calls, AVG(duration_ms) as avg_ms, SUM(CASE WHEN success = 0 THEN 1 ELSE 0 END) as errors
         FROM tool_metrics GROUP BY tool_name ORDER BY calls DESC LIMIT 20`
      ).all();
      return Response.json({ tools });
    } catch {
      return Response.json({ tools: [] });
    }
  }

  // GET /api/dashboard/analytics/sessions
  if (path === "/analytics/sessions" && req.method === "GET") {
    try {
      const db = getDb();
      const sessions = db.query(
        `SELECT session_id, provider, model, SUM(input_tokens) as input_tokens, SUM(output_tokens) as output_tokens,
                COALESCE(SUM(cost_usd), 0) as cost, COUNT(*) as requests, MAX(created_at) as last_used
         FROM usage GROUP BY session_id ORDER BY last_used DESC LIMIT 20`
      ).all();
      return Response.json({ sessions });
    } catch {
      return Response.json({ sessions: [] });
    }
  }

  // GET /api/dashboard/onboarding
  if (path === "/onboarding" && req.method === "GET") {
    try {
      const onboardingPath = join(paths.workspace, ".onboarding.json");
      if (existsSync(onboardingPath)) {
        return Response.json(JSON.parse(readFileSync(onboardingPath, "utf-8")));
      }
      return Response.json({ completed: false, step: 0 });
    } catch {
      return Response.json({ completed: false, step: 0 });
    }
  }

  // PUT /api/dashboard/onboarding
  if (path === "/onboarding" && req.method === "PUT") {
    return (async () => {
      const body = await req.json() as any;
      const onboardingPath = join(paths.workspace, ".onboarding.json");
      writeFileSync(onboardingPath, JSON.stringify(body, null, 2));
      return Response.json({ ok: true });
    })() as any;
  }

  // POST /api/dashboard/test-llm
  if (path === "/test-llm" && req.method === "POST") {
    return (async () => {
      try {
        const { loadConfig } = await import("../config/loader");
        const { createProvider } = await import("../llm/factory");
        const config = await loadConfig();
        const llm = createProvider(config);
        const res = await llm.chat({
          system: "You are a test.",
          messages: [{ role: "user", content: [{ type: "text", text: "Say OK" }] }],
          maxTokens: 10,
        });
        const text = res.content.find((b: any) => b.type === "text")?.text ?? "";
        return Response.json({ ok: true, response: text, model: llm.model });
      } catch (err: any) {
        return Response.json({ ok: false, error: err.message });
      }
    })() as any;
  }

  // GET /api/dashboard/channel-status
  if (path === "/channel-status" && req.method === "GET") {
    try {
      const config = JSON.parse(readFileSync(paths.config, "utf-8"));
      const channels: Record<string, { configured: boolean; enabled: boolean }> = {};

      channels.webchat = { configured: true, enabled: config.channels?.webchat?.enabled !== false };
      channels.telegram = {
        configured: !!(config.channels?.telegram?.botToken || config.telegramBotToken),
        enabled: config.channels?.telegram?.enabled !== false && !!(config.channels?.telegram?.botToken || config.telegramBotToken),
      };
      channels.discord = {
        configured: !!config.channels?.discord?.botToken,
        enabled: config.channels?.discord?.enabled !== false && !!config.channels?.discord?.botToken,
      };
      channels.slack = {
        configured: !!config.channels?.slack?.botToken,
        enabled: config.channels?.slack?.enabled !== false && !!config.channels?.slack?.botToken,
      };
      channels.whatsapp = {
        configured: !!config.channels?.whatsapp,
        enabled: config.channels?.whatsapp?.enabled !== false && !!config.channels?.whatsapp,
      };
      channels.signal = {
        configured: !!config.channels?.signal?.phoneNumber,
        enabled: config.channels?.signal?.enabled !== false && !!config.channels?.signal?.phoneNumber,
      };

      return Response.json({ channels });
    } catch {
      return Response.json({ channels: {} });
    }
  }

  // GET /api/dashboard/registry/search?q=...
  if (path === "/registry/search" && req.method === "GET") {
    return (async () => {
      try {
        const { searchRegistry } = await import("../registry/client");
        const q = url.searchParams.get("q") ?? "";
        const results = await searchRegistry(q);
        return Response.json({ results });
      } catch (err: any) {
        return Response.json({ results: [], error: err.message });
      }
    })() as any;
  }

  // POST /api/dashboard/registry/install
  if (path === "/registry/install" && req.method === "POST") {
    return (async () => {
      try {
        const body = await req.json() as { name?: string };
        if (!body.name) return Response.json({ ok: false, error: "name required" }, { status: 400 });
        const { installFromRegistry } = await import("../registry/installer");
        const result = await installFromRegistry(body.name);
        return Response.json({ ok: true, ...result });
      } catch (err: any) {
        return Response.json({ ok: false, error: err.message });
      }
    })() as any;
  }

  // GET /api/dashboard/workflows
  if (path === "/workflows" && req.method === "GET") {
    return (async () => {
      try {
        const { loadWorkflowDefinitions } = await import("../agent/workflow");
        const workflows = loadWorkflowDefinitions();
        return Response.json({ workflows: workflows.map((w: any) => ({ name: w.name, description: w.description, agents: w.agents, steps: w.steps.length })) });
      } catch {
        return Response.json({ workflows: [] });
      }
    })() as any;
  }

  // GET /api/dashboard/recipes
  if (path === "/recipes" && req.method === "GET") {
    return (async () => {
      try {
        const { WORKFLOW_RECIPES } = await import("../scheduler/recipes");
        const db = getDb();
        // Check which recipes are already installed as cron jobs
        const installedJobs = db.query("SELECT name FROM cron_jobs").all() as { name: string }[];
        const installedNames = new Set(installedJobs.map(j => j.name));

        const recipes = WORKFLOW_RECIPES.map(r => ({
          ...r,
          installed: installedNames.has(r.id),
        }));
        return Response.json({ recipes });
      } catch (err: any) {
        return Response.json({ recipes: [], error: err.message });
      }
    })() as any;
  }

  // POST /api/dashboard/recipes/install
  if (path === "/recipes/install" && req.method === "POST") {
    return (async () => {
      try {
        const body = (await req.json()) as { id?: string };
        if (!body.id) return Response.json({ ok: false, error: "Recipe ID required" }, { status: 400 });

        const { getRecipeById } = await import("../scheduler/recipes");
        const recipe = getRecipeById(body.id);
        if (!recipe) return Response.json({ ok: false, error: "Recipe not found" }, { status: 404 });

        const db = getDb();
        // Check if already installed
        const existing = db.query("SELECT id FROM cron_jobs WHERE name = ?").get(recipe.id);
        if (existing) return Response.json({ ok: false, error: "Recipe already installed" }, { status: 409 });

        // Insert as a cron job
        db.prepare(
          "INSERT INTO cron_jobs (name, schedule, task) VALUES (?, ?, ?)"
        ).run(recipe.id, recipe.schedule, recipe.task);

        return Response.json({ ok: true, name: recipe.name });
      } catch (err: any) {
        return Response.json({ ok: false, error: err.message }, { status: 500 });
      }
    })() as any;
  }

  // POST /api/dashboard/recipes/uninstall
  if (path === "/recipes/uninstall" && req.method === "POST") {
    return (async () => {
      try {
        const body = (await req.json()) as { id?: string };
        if (!body.id) return Response.json({ ok: false, error: "Recipe ID required" }, { status: 400 });

        // Validate that this is a known recipe ID — prevent arbitrary cron job deletion
        const { getRecipeById } = await import("../scheduler/recipes");
        if (!getRecipeById(body.id)) {
          return Response.json({ ok: false, error: "Unknown recipe ID" }, { status: 400 });
        }

        const db = getDb();
        const result = db.prepare("DELETE FROM cron_jobs WHERE name = ?").run(body.id);
        return Response.json({ ok: true, deleted: result.changes > 0 });
      } catch (err: any) {
        return Response.json({ ok: false, error: err.message }, { status: 500 });
      }
    })() as any;
  }

  // POST /api/dashboard/export — JSON export
  if (path === "/export" && req.method === "POST") {
    try {
      const db = getDb();
      const outputPath = join(paths.workspace, `export-${Date.now()}.json`);
      exportDatabase(db, outputPath);
      const data = readFileSync(outputPath, "utf-8");
      // Clean up temp file
      try { const { unlinkSync } = require("fs"); unlinkSync(outputPath); } catch (err: any) { logger.warn("Failed to clean up export file", { error: (err as Error).message }); }
      return new Response(data, {
        headers: {
          "Content-Type": "application/json",
          "Content-Disposition": `attachment; filename="zubo-export.json"`,
        },
      });
    } catch (err: any) {
      return Response.json({ error: err.message }, { status: 500 });
    }
  }

  // POST /api/dashboard/backup — SQLite backup
  if (path === "/backup" && req.method === "POST") {
    try {
      const backupPath = backupDatabase(paths.db, paths.workspace);
      return Response.json({ ok: true, path: backupPath });
    } catch (err: any) {
      return Response.json({ error: err.message }, { status: 500 });
    }
  }

  // POST /api/dashboard/import — JSON import (max 100MB)
  if (path === "/import" && req.method === "POST") {
    return (async () => {
      const tmpPath = join(paths.workspace, `import-${Date.now()}.json`);
      try {
        const contentLength = parseInt(req.headers.get("content-length") ?? "0", 10);
        if (contentLength > 100 * 1024 * 1024) {
          return Response.json({ error: "Import too large (max 100MB)" }, { status: 413 });
        }
        const body = await req.text();
        if (body.length > 100 * 1024 * 1024) {
          return Response.json({ error: "Import too large (max 100MB)" }, { status: 413 });
        }
        writeFileSync(tmpPath, body);
        const db = getDb();
        const result = importDatabase(db, tmpPath);
        return Response.json({ ok: true, ...result });
      } catch (err: any) {
        return Response.json({ error: err.message }, { status: 500 });
      } finally {
        try { const { unlinkSync } = require("fs"); unlinkSync(tmpPath); } catch (err: any) { logger.warn("Failed to clean up import temp file", { error: (err as Error).message }); }
      }
    })() as any;
  }

  // GET /api/dashboard/db-stats
  if (path === "/db-stats" && req.method === "GET") {
    try {
      const db = getDb();
      const stats = getDbStats(db);
      const sizeBytes = getDbSizeBytes(paths.db);
      return Response.json({ ...stats, sizeBytes });
    } catch {
      return Response.json({ tables: {}, sizeBytes: 0 });
    }
  }

  // GET /api/dashboard/agents
  if (path === "/agents" && req.method === "GET") {
    return (async () => {
      try {
        const { loadAgentDefinitions } = await import("../agent/agents");
        const agents = loadAgentDefinitions();
        return Response.json({ agents: agents.map((a: any) => ({ name: a.name, description: a.description, tools: a.tools?.length ?? 0 })) });
      } catch {
        return Response.json({ agents: [] });
      }
    })() as any;
  }

  // GET /api/dashboard/analytics/perf-snapshots
  if (path === "/analytics/perf-snapshots" && req.method === "GET") {
    try {
      const db = getDb();
      const rows = db.query(
        `SELECT rss_mb, heap_mb, db_size_mb, created_at
         FROM perf_snapshots WHERE created_at >= datetime('now', '-7 days')
         ORDER BY created_at`
      ).all();
      return Response.json({ snapshots: rows });
    } catch {
      return Response.json({ snapshots: [] });
    }
  }

  // GET /api/dashboard/analytics/cost-breakdown
  if (path === "/analytics/cost-breakdown" && req.method === "GET") {
    try {
      const db = getDb();
      const rows = db.query(
        `SELECT provider, model,
                SUM(input_tokens + output_tokens) as total_tokens,
                COALESCE(SUM(cost_usd), 0) as total_cost,
                COUNT(*) as requests
         FROM usage GROUP BY provider, model ORDER BY total_cost DESC`
      ).all();
      return Response.json({ breakdown: rows });
    } catch {
      return Response.json({ breakdown: [] });
    }
  }

  // GET /api/dashboard/analytics/response-time-trend
  if (path === "/analytics/response-time-trend" && req.method === "GET") {
    try {
      const db = getDb();
      const rows = db.query(
        `SELECT date(created_at) as day,
                ROUND(AVG(response_time_ms)) as avg_ms,
                MIN(response_time_ms) as min_ms,
                MAX(response_time_ms) as max_ms,
                COUNT(*) as requests
         FROM usage WHERE response_time_ms IS NOT NULL
           AND created_at >= datetime('now', '-7 days')
         GROUP BY day ORDER BY day`
      ).all();
      return Response.json({ trend: rows });
    } catch {
      return Response.json({ trend: [] });
    }
  }

  // GET /api/dashboard/analytics/top-models
  if (path === "/analytics/top-models" && req.method === "GET") {
    try {
      const db = getDb();
      const rows = db.query(
        `SELECT provider, model,
                COUNT(*) as requests,
                SUM(input_tokens + output_tokens) as total_tokens,
                COALESCE(SUM(cost_usd), 0) as total_cost,
                ROUND(AVG(response_time_ms)) as avg_response_ms
         FROM usage GROUP BY provider, model
         ORDER BY total_tokens DESC LIMIT 10`
      ).all();
      return Response.json({ models: rows });
    } catch {
      return Response.json({ models: [] });
    }
  }

  // --- Budget controls ---

  // GET /api/dashboard/budget
  if (path === "/budget" && req.method === "GET") {
    try {
      const db = getDb();
      // Ensure table exists (migration may not have run yet)
      db.run(`CREATE TABLE IF NOT EXISTS budget_config (
        id INTEGER PRIMARY KEY CHECK (id = 1),
        daily_limit_usd REAL,
        monthly_limit_usd REAL,
        alert_threshold REAL DEFAULT 0.8,
        paused INTEGER NOT NULL DEFAULT 0,
        updated_at TEXT NOT NULL DEFAULT (datetime('now'))
      )`);
      db.run("INSERT OR IGNORE INTO budget_config (id) VALUES (1)");

      const config = db.query("SELECT * FROM budget_config WHERE id = 1").get() as any;

      // Calculate current spend
      const todaySpend = db.query(
        "SELECT COALESCE(SUM(cost_usd), 0) as total FROM usage WHERE date(created_at) = date('now') AND cost_usd IS NOT NULL"
      ).get() as any;

      const monthSpend = db.query(
        "SELECT COALESCE(SUM(cost_usd), 0) as total FROM usage WHERE created_at >= datetime('now', 'start of month') AND cost_usd IS NOT NULL"
      ).get() as any;

      // Last 7 days daily breakdown
      const dailyBreakdown = db.query(
        `SELECT date(created_at) as day, COALESCE(SUM(cost_usd), 0) as cost, SUM(input_tokens + output_tokens) as tokens
         FROM usage WHERE created_at >= datetime('now', '-7 days') AND cost_usd IS NOT NULL
         GROUP BY day ORDER BY day`
      ).all();

      return Response.json({
        daily_limit_usd: config?.daily_limit_usd ?? null,
        monthly_limit_usd: config?.monthly_limit_usd ?? null,
        alert_threshold: config?.alert_threshold ?? 0.8,
        paused: config?.paused === 1,
        today_spend_usd: Math.round((todaySpend?.total ?? 0) * 10000) / 10000,
        month_spend_usd: Math.round((monthSpend?.total ?? 0) * 10000) / 10000,
        daily_breakdown: dailyBreakdown,
      });
    } catch (err: any) {
      return Response.json({ error: err.message }, { status: 500 });
    }
  }

  // PUT /api/dashboard/budget
  if (path === "/budget" && req.method === "PUT") {
    return (async () => {
      try {
        const body = (await req.json()) as {
          daily_limit_usd?: number | null;
          monthly_limit_usd?: number | null;
          alert_threshold?: number;
        };
        const db = getDb();
        db.run(`CREATE TABLE IF NOT EXISTS budget_config (
          id INTEGER PRIMARY KEY CHECK (id = 1),
          daily_limit_usd REAL,
          monthly_limit_usd REAL,
          alert_threshold REAL DEFAULT 0.8,
          paused INTEGER NOT NULL DEFAULT 0,
          updated_at TEXT NOT NULL DEFAULT (datetime('now'))
        )`);
        db.run("INSERT OR IGNORE INTO budget_config (id) VALUES (1)");

        db.prepare(
          `UPDATE budget_config SET
            daily_limit_usd = ?,
            monthly_limit_usd = ?,
            alert_threshold = ?,
            paused = 0,
            updated_at = datetime('now')
          WHERE id = 1`
        ).run(
          body.daily_limit_usd ?? null,
          body.monthly_limit_usd ?? null,
          body.alert_threshold ?? 0.8
        );
        return Response.json({ ok: true });
      } catch (err: any) {
        return Response.json({ error: err.message }, { status: 500 });
      }
    })() as any;
  }

  // --- Privacy dashboard ---

  // GET /api/dashboard/privacy/summary
  if (path === "/privacy/summary" && req.method === "GET") {
    try {
      const db = getDb();

      const memoryCount = (db.query("SELECT COUNT(*) as c FROM memory_chunks").get() as any)?.c ?? 0;

      // Messages are stored as JSONL files in sessions dir, not in SQL
      let messageCount = 0;
      let sessionCount = 0;
      try {
        const sessionFiles = readdirSync(paths.sessions).filter(f => f.endsWith(".jsonl"));
        sessionCount = sessionFiles.length;
        for (const file of sessionFiles) {
          const content = readFileSync(join(paths.sessions, file), "utf-8");
          messageCount += content.trim().split("\n").filter(Boolean).length;
        }
      } catch {}

      const secretCount = (db.query("SELECT COUNT(*) as c FROM secrets").get() as any)?.c ?? 0;
      const cronCount = (db.query("SELECT COUNT(*) as c FROM cron_jobs").get() as any)?.c ?? 0;
      const apiCallCount = (db.query("SELECT COUNT(*) as c FROM usage").get() as any)?.c ?? 0;
      let toolCallCount = 0;
      try { toolCallCount = (db.query("SELECT COUNT(*) as c FROM tool_metrics").get() as any)?.c ?? 0; } catch {}
      const totalTokensSent = (db.query("SELECT COALESCE(SUM(input_tokens), 0) as t FROM usage").get() as any)?.t ?? 0;
      const totalTokensReceived = (db.query("SELECT COALESCE(SUM(output_tokens), 0) as t FROM usage").get() as any)?.t ?? 0;

      // Data by provider
      const providerBreakdown = db.query(
        "SELECT provider, COUNT(*) as calls, SUM(input_tokens) as tokens_sent FROM usage GROUP BY provider ORDER BY calls DESC"
      ).all();

      return Response.json({
        memoryCount,
        messageCount,
        sessionCount,
        secretCount,
        cronCount,
        apiCallCount,
        toolCallCount,
        totalTokensSent,
        totalTokensReceived,
        providerBreakdown,
      });
    } catch (err: any) {
      return Response.json({ error: err.message }, { status: 500 });
    }
  }

  // GET /api/dashboard/privacy/api-log
  if (path === "/privacy/api-log" && req.method === "GET") {
    try {
      const db = getDb();
      const limit = parseInt(url.searchParams.get("limit") ?? "50", 10);
      const offset = parseInt(url.searchParams.get("offset") ?? "0", 10);

      const rows = db.query(
        `SELECT id, session_id, provider, model, input_tokens, output_tokens,
                cost_usd, response_time_ms, created_at
         FROM usage ORDER BY created_at DESC LIMIT ? OFFSET ?`
      ).all(Math.min(limit, 100), offset);

      const total = (db.query("SELECT COUNT(*) as c FROM usage").get() as any)?.c ?? 0;

      return Response.json({ rows, total, limit, offset });
    } catch (err: any) {
      return Response.json({ rows: [], total: 0, error: err.message });
    }
  }

  // GET /api/dashboard/privacy/tool-log
  if (path === "/privacy/tool-log" && req.method === "GET") {
    try {
      const db = getDb();
      const limit = parseInt(url.searchParams.get("limit") ?? "50", 10);
      const offset = parseInt(url.searchParams.get("offset") ?? "0", 10);

      const rows = db.query(
        `SELECT id, tool_name, session_id, duration_ms, success, created_at
         FROM tool_metrics ORDER BY created_at DESC LIMIT ? OFFSET ?`
      ).all(Math.min(limit, 100), offset);

      const total = (db.query("SELECT COUNT(*) as c FROM tool_metrics").get() as any)?.c ?? 0;

      return Response.json({ rows, total, limit, offset });
    } catch (err: any) {
      return Response.json({ rows: [], total: 0, error: err.message });
    }
  }

  // POST /api/dashboard/privacy/wipe-memories
  if (path === "/privacy/wipe-memories" && req.method === "POST") {
    return (async () => {
      try {
        const body = (await req.json()) as { confirm?: string };
        if (body.confirm !== "DELETE") return Response.json({ ok: false, error: "Confirmation required: send { confirm: \"DELETE\" }" }, { status: 400 });
        const db = getDb();
        db.run("DELETE FROM memory_chunks");
        db.run("DELETE FROM memory_fts");
        return Response.json({ ok: true, message: "All memories deleted" });
      } catch (err: any) {
        return Response.json({ ok: false, error: err.message }, { status: 500 });
      }
    })() as any;
  }

  // POST /api/dashboard/privacy/wipe-messages
  if (path === "/privacy/wipe-messages" && req.method === "POST") {
    return (async () => {
      try {
        const body = (await req.json()) as { confirm?: string };
        if (body.confirm !== "DELETE") return Response.json({ ok: false, error: "Confirmation required: send { confirm: \"DELETE\" }" }, { status: 400 });
        const db = getDb();
        db.run("DELETE FROM messages");
        return Response.json({ ok: true, message: "All messages deleted" });
      } catch (err: any) {
        return Response.json({ ok: false, error: err.message }, { status: 500 });
      }
    })() as any;
  }

  // POST /api/dashboard/privacy/wipe-usage
  if (path === "/privacy/wipe-usage" && req.method === "POST") {
    return (async () => {
      try {
        const body = (await req.json()) as { confirm?: string };
        if (body.confirm !== "DELETE") return Response.json({ ok: false, error: "Confirmation required: send { confirm: \"DELETE\" }" }, { status: 400 });
        const db = getDb();
        db.run("DELETE FROM usage");
        db.run("DELETE FROM tool_metrics");
        return Response.json({ ok: true, message: "All usage data deleted" });
      } catch (err: any) {
        return Response.json({ ok: false, error: err.message }, { status: 500 });
      }
    })() as any;
  }

  // POST /api/dashboard/privacy/wipe-all
  if (path === "/privacy/wipe-all" && req.method === "POST") {
    return (async () => {
      try {
        const body = (await req.json()) as { confirm?: string };
        if (body.confirm !== "DELETE_ALL") return Response.json({ ok: false, error: "Confirmation required: send { confirm: \"DELETE_ALL\" }" }, { status: 400 });
        const db = getDb();
        db.run("DELETE FROM memory_chunks");
        db.run("DELETE FROM memory_fts");
        db.run("DELETE FROM messages");
        db.run("DELETE FROM usage");
        db.run("DELETE FROM tool_metrics");
        db.run("DELETE FROM secrets");
        db.run("DELETE FROM cron_logs");
        return Response.json({ ok: true, message: "All data wiped" });
      } catch (err: any) {
        return Response.json({ ok: false, error: err.message }, { status: 500 });
      }
    })() as any;
  }

  // --- Secrets management ---

  // GET /api/dashboard/secrets — list all secrets (values masked) + config provider keys
  if (path === "/secrets" && req.method === "GET") {
    try {
      const db = getDb();
      const rows = db.query("SELECT name, service, updated_at FROM secrets ORDER BY name").all() as { name: string; service: string | null; updated_at: string }[];

      // Also surface provider API keys from config (read-only)
      const configKeys: { name: string; service: string; updated_at: string; source: string }[] = [];
      try {
        const cfg = JSON.parse(readFileSync(paths.config, "utf-8"));
        if (cfg.providers) {
          for (const [provider, pCfg] of Object.entries(cfg.providers)) {
            const pc = pCfg as Record<string, unknown>;
            if (pc.apiKey && typeof pc.apiKey === "string") {
              configKeys.push({
                name: `${provider}_api_key`,
                service: provider,
                updated_at: "",
                source: "config",
              });
            }
          }
        }
      } catch (err: any) {
        logger.warn("Failed to read provider API keys from config", { error: (err as Error).message });
      }

      const secrets = [
        ...configKeys,
        ...rows.map(r => ({ ...r, source: "secrets" })),
      ];
      return Response.json({ secrets });
    } catch {
      return Response.json({ secrets: [] });
    }
  }

  // GET /api/dashboard/secrets/:name — reveal a secret value (dashboard is localhost-only + session-authenticated)
  if (path.startsWith("/secrets/") && req.method === "GET") {
    const secretName = decodeURIComponent(path.replace("/secrets/", ""));
    if (!secretName || !/^[a-z0-9_]+$/.test(secretName)) {
      return Response.json({ error: "Invalid secret name" }, { status: 400 });
    }
    try {
      const { maskToken } = require("../util/mask") as { maskToken: (s: string) => string };
      // Check config provider keys first
      if (secretName.endsWith("_api_key")) {
        const provider = secretName.replace(/_api_key$/, "");
        try {
          const cfg = JSON.parse(readFileSync(paths.config, "utf-8"));
          if (cfg.providers?.[provider]?.apiKey) {
            const key = cfg.providers[provider].apiKey;
            return Response.json({ name: secretName, value: maskToken(key), source: "config" });
          }
        } catch (err: any) {
          logger.warn("Failed to read provider secret from config", { error: (err as Error).message });
        }
      }
      const db = getDb();
      const { getSecret } = require("../secrets/store") as { getSecret: (name: string) => string | null };
      const value = getSecret(secretName);
      if (!value) return Response.json({ error: "Not found" }, { status: 404 });
      return Response.json({ name: secretName, value: maskToken(value), source: "secrets" });
    } catch (err: any) {
      return Response.json({ error: err.message }, { status: 500 });
    }
  }

  // POST /api/dashboard/secrets — create or update a secret
  if (path === "/secrets" && req.method === "POST") {
    return (async () => {
      const body = (await req.json()) as { name?: string; value?: string; service?: string };
      if (!body.name || !/^[a-z0-9_]+$/.test(body.name)) {
        return Response.json({ error: "Name must match [a-z0-9_]+" }, { status: 400 });
      }
      if (!body.value) {
        return Response.json({ error: "Value is required" }, { status: 400 });
      }
      try {
        const db = getDb();
        db.prepare(
          `INSERT INTO secrets (name, value, service, updated_at)
           VALUES (?, ?, ?, datetime('now'))
           ON CONFLICT(name) DO UPDATE SET value = excluded.value, service = excluded.service, updated_at = datetime('now')`
        ).run(body.name, body.value, body.service ?? null);
        return Response.json({ ok: true });
      } catch (err: any) {
        return Response.json({ error: err.message }, { status: 500 });
      }
    })() as any;
  }

  // DELETE /api/dashboard/secrets/:name — delete a secret
  if (path.startsWith("/secrets/") && req.method === "DELETE") {
    const secretName = decodeURIComponent(path.replace("/secrets/", ""));
    if (!secretName || !/^[a-z0-9_]+$/.test(secretName)) {
      return Response.json({ error: "Invalid secret name" }, { status: 400 });
    }
    try {
      const db = getDb();
      const result = db.prepare("DELETE FROM secrets WHERE name = ?").run(secretName);
      return Response.json({ deleted: result.changes > 0 });
    } catch (err: any) {
      return Response.json({ error: err.message }, { status: 500 });
    }
  }

  // --- Webhook ingress ---

  // POST /api/dashboard/webhook/:name
  if (path.startsWith("/webhook/") && req.method === "POST") {
    const webhookName = path.slice("/webhook/".length);
    if (!webhookName || !/^[a-z0-9_-]+$/i.test(webhookName)) {
      return Response.json({ error: "Invalid webhook name" }, { status: 400 });
    }
    return (async () => {
      try {
        // Budget enforcement — block webhooks when budget exceeded
        const db = getDb();
        try {
          const budgetConfig = db.query("SELECT paused FROM budget_config WHERE id = 1").get() as { paused: number } | null;
          if (budgetConfig?.paused) {
            return Response.json({ error: "Budget exceeded — agent is paused" }, { status: 429 });
          }
        } catch { /* budget table may not exist */ }

        const payload = await req.json();
        const summary = JSON.stringify(payload).slice(0, 500);
        const message = `[Webhook: ${webhookName}] ${summary}`;
        const { loadConfig } = await import("../config/loader");
        const { createProvider } = await import("../llm/factory");
        const config = await loadConfig();
        const webhookLlm = createProvider(config);
        const { agentLoop } = await import("../agent/loop");
        const sessionKey = `webhook:${webhookName}`;
        const result = await agentLoop(webhookLlm, sessionKey, message);
        return Response.json({ ok: true, reply: result.reply });
      } catch (err: any) {
        return Response.json({ error: err.message }, { status: 500 });
      }
    })() as any;
  }

  // --- Conversation threads CRUD ---

  // GET /api/dashboard/threads — list all threads
  if (path === "/threads" && req.method === "GET") {
    try {
      const db = getDb();
      const threads = db.query(
        "SELECT id, title, created_at, updated_at FROM threads ORDER BY updated_at DESC"
      ).all();
      return Response.json({ threads });
    } catch (err: any) {
      return Response.json({ threads: [], error: err.message });
    }
  }

  // POST /api/dashboard/threads — create new thread
  if (path === "/threads" && req.method === "POST") {
    return (async () => {
      const { title } = await req.json().catch(() => ({ title: undefined }));
      const id = crypto.randomUUID();
      const db = getDb();
      db.prepare(
        "INSERT INTO threads (id, title) VALUES (?, ?)"
      ).run(id, title || "New conversation");
      return Response.json({ id, title: title || "New conversation" });
    })() as any;
  }

  // PUT /api/dashboard/threads/:id — rename thread
  if (path.match(/^\/threads\/[a-f0-9-]+$/) && req.method === "PUT") {
    return (async () => {
      const threadId = path.split("/").pop()!;
      const { title } = await req.json();
      const db = getDb();
      db.prepare(
        "UPDATE threads SET title = ?, updated_at = datetime('now') WHERE id = ?"
      ).run(title, threadId);
      return Response.json({ ok: true });
    })() as any;
  }

  // DELETE /api/dashboard/threads/:id — delete thread and session file
  if (path.match(/^\/threads\/[a-f0-9-]+$/) && req.method === "DELETE") {
    const threadId = path.split("/").pop()!;
    try {
      const db = getDb();
      db.prepare("DELETE FROM threads WHERE id = ?").run(threadId);
      const sessionPath = join(paths.sessions, threadId + ".jsonl");
      if (existsSync(sessionPath)) unlinkSync(sessionPath);
      return Response.json({ ok: true });
    } catch (err: any) {
      return Response.json({ error: err.message }, { status: 500 });
    }
  }

  // GET /api/dashboard/threads/:id/messages — get thread messages
  if (path.match(/^\/threads\/[a-f0-9-]+\/messages$/) && req.method === "GET") {
    return (async () => {
      const threadId = path.split("/")[2];
      const { loadSession } = await import("../agent/session");
      const messages = loadSession(threadId, 100);
      return Response.json({ messages });
    })() as any;
  }

  // GET /api/dashboard/threads/:id/export — export thread as markdown
  if (path.match(/^\/threads\/[a-f0-9-]+\/export$/) && req.method === "GET") {
    return (async () => {
      const threadId = path.split("/")[2];
      const { loadSession } = await import("../agent/session");
      const messages = loadSession(threadId, 1000);
      const db = getDb();
      const thread = db.query(
        "SELECT title FROM threads WHERE id = ?"
      ).get(threadId) as { title: string } | null;

      let md = "# " + (thread?.title || "Conversation") + "\n\n";
      for (const m of messages) {
        const role = m.role === "user" ? "**You**" : "**Zubo**";
        const text = Array.isArray(m.content)
          ? m.content
              .filter((b: any) => b.type === "text")
              .map((b: any) => b.text)
              .join("\n")
          : String(m.content);
        md += role + ": " + text + "\n\n";
      }

      return new Response(md, {
        headers: {
          "Content-Type": "text/markdown",
          "Content-Disposition": `attachment; filename="${threadId.slice(0, 8)}.md"`,
        },
      });
    })() as any;
  }

  // --- OAuth management API ---

  // GET /api/dashboard/oauth/status — list all OAuth connections
  if (path === "/oauth/status" && req.method === "GET") {
    return (async () => {
      try {
        const { listConnections, isProviderConfigured, listSupportedProviders } = await import("../tools/oauth");
        const connections = listConnections();
        const supported = listSupportedProviders();
        return Response.json({
          supported,
          connections: connections.map((c: any) => ({
            ...c,
            configured: isProviderConfigured(c.provider),
          })),
        });
      } catch (err: any) {
        return Response.json({ supported: [], connections: [], error: err.message });
      }
    })() as any;
  }

  // DELETE /api/dashboard/oauth/:provider — revoke connection
  if (path.startsWith("/oauth/") && path.split("/").length === 2 && req.method === "DELETE") {
    const provider = path.replace("/oauth/", "");
    if (!provider || !/^[a-z]+$/.test(provider)) {
      return Response.json({ error: "Invalid provider name" }, { status: 400 });
    }
    return (async () => {
      try {
        const { revokeToken } = await import("../tools/oauth");
        const removed = await revokeToken(provider);
        return Response.json({ ok: removed, provider });
      } catch (err: any) {
        return Response.json({ error: err.message }, { status: 500 });
      }
    })() as any;
  }

  // PUT /api/dashboard/oauth/:provider/config — save OAuth provider credentials
  if (path.match(/^\/oauth\/[a-z]+\/config$/) && req.method === "PUT") {
    const provider = path.split("/")[2];
    const allowed = ["google", "github", "notion", "linear", "slack"];
    if (!allowed.includes(provider)) {
      return Response.json({ error: "Unsupported provider: " + provider }, { status: 400 });
    }
    return (async () => {
      try {
        const body = await req.json();
        const clientId = String(body.clientId || "").trim();
        const clientSecret = String(body.clientSecret || "").trim();
        if (!clientId || !clientSecret) {
          return Response.json({ error: "clientId and clientSecret are required" }, { status: 400 });
        }
        // Load current config, merge in OAuth credentials, save
        const { loadConfig, saveConfig } = await import("../config/loader");
        const config = await loadConfig();
        if (!config.oauth) (config as any).oauth = {};
        if (!config.oauth!.providers) (config.oauth as any).providers = {};
        (config.oauth!.providers as any)[provider] = { clientId, clientSecret };
        await saveConfig(config);
        return Response.json({ ok: true, provider });
      } catch (err: any) {
        return Response.json({ error: err.message }, { status: 500 });
      }
    })() as any;
  }

  // DELETE /api/dashboard/oauth/:provider/config — remove OAuth provider credentials
  if (path.match(/^\/oauth\/[a-z]+\/config$/) && req.method === "DELETE") {
    const provider = path.split("/")[2];
    return (async () => {
      try {
        const { loadConfig, saveConfig } = await import("../config/loader");
        const config = await loadConfig();
        if (config.oauth?.providers) {
          delete (config.oauth.providers as any)[provider];
          await saveConfig(config);
        }
        return Response.json({ ok: true, provider });
      } catch (err: any) {
        return Response.json({ error: err.message }, { status: 500 });
      }
    })() as any;
  }

  // --- Channel Config Endpoints ---

  // GET /api/dashboard/channels/config — all channel configs with running status
  if (path === "/channels/config" && req.method === "GET") {
    return (async () => {
      try {
        const { maskToken } = await import("../util/mask");
        const { getRunningChannels } = await import("./lifecycle");
        const config = JSON.parse(readFileSync(paths.config, "utf-8"));
        const running = new Set(getRunningChannels());

        const channelDefs: Record<string, any> = {};
        const ch = config.channels || {};

        // Telegram
        const tgToken = ch.telegram?.botToken || config.telegramBotToken || "";
        channelDefs.telegram = {
          enabled: ch.telegram?.enabled !== false && !!tgToken,
          configured: !!tgToken,
          running: running.has("telegram"),
          config: {
            botToken: tgToken ? maskToken(tgToken) : "",
            allowedUsers: ch.telegram?.allowedUsers || config.telegramAllowedUsers || [],
          },
        };

        // Discord
        channelDefs.discord = {
          enabled: ch.discord?.enabled !== false && !!ch.discord?.botToken,
          configured: !!ch.discord?.botToken,
          running: running.has("discord"),
          config: {
            botToken: ch.discord?.botToken ? maskToken(ch.discord.botToken) : "",
            allowedUsers: ch.discord?.allowedUsers || [],
          },
        };

        // Slack
        channelDefs.slack = {
          enabled: ch.slack?.enabled !== false && !!ch.slack?.botToken,
          configured: !!ch.slack?.botToken,
          running: running.has("slack"),
          config: {
            botToken: ch.slack?.botToken ? maskToken(ch.slack.botToken) : "",
            appToken: ch.slack?.appToken ? maskToken(ch.slack.appToken) : "",
            allowedUsers: ch.slack?.allowedUsers || [],
          },
        };

        // WhatsApp
        channelDefs.whatsapp = {
          enabled: ch.whatsapp?.enabled !== false && !!ch.whatsapp,
          configured: !!ch.whatsapp,
          running: running.has("whatsapp"),
          config: {
            authDir: ch.whatsapp?.authDir || "",
            allowedNumbers: ch.whatsapp?.allowedNumbers || [],
          },
        };

        // Signal
        channelDefs.signal = {
          enabled: ch.signal?.enabled !== false && !!ch.signal?.phoneNumber,
          configured: !!ch.signal?.phoneNumber,
          running: running.has("signal"),
          config: {
            phoneNumber: ch.signal?.phoneNumber || "",
            signalCliPath: ch.signal?.signalCliPath || "",
            allowedNumbers: ch.signal?.allowedNumbers || [],
          },
        };

        // Email
        channelDefs.email = {
          enabled: ch.email?.enabled !== false && !!ch.email?.imap?.host,
          configured: !!ch.email?.imap?.host,
          running: running.has("email"),
          config: {
            imap: ch.email?.imap ? {
              host: ch.email.imap.host || "",
              port: ch.email.imap.port || 993,
              user: ch.email.imap.user || "",
              password: ch.email.imap.password ? maskToken(ch.email.imap.password) : "",
              tls: ch.email.imap.tls !== false,
            } : { host: "", port: 993, user: "", password: "", tls: true },
            smtp: ch.email?.smtp ? {
              host: ch.email.smtp.host || "",
              port: ch.email.smtp.port || 587,
              user: ch.email.smtp.user || "",
              password: ch.email.smtp.password ? maskToken(ch.email.smtp.password) : "",
              tls: ch.email.smtp.tls !== false,
            } : { host: "", port: 587, user: "", password: "", tls: true },
            pollIntervalSeconds: ch.email?.pollIntervalSeconds || 60,
            allowedSenders: ch.email?.allowedSenders || [],
            fromName: ch.email?.fromName || "",
          },
        };

        return Response.json({ channels: channelDefs });
      } catch (err: any) {
        return Response.json({ error: err.message }, { status: 500 });
      }
    })() as any;
  }

  // PUT /api/dashboard/channels/:name/config — save channel config + hot-start if enabled
  const channelConfigMatch = path.match(/^\/channels\/([a-z]+)\/config$/);
  if (channelConfigMatch && req.method === "PUT") {
    const channelName = channelConfigMatch[1];
    const validChannels = ["telegram", "discord", "slack", "whatsapp", "signal", "email"];
    if (!validChannels.includes(channelName)) {
      return Response.json({ error: "Invalid channel: " + channelName }, { status: 400 });
    }
    return (async () => {
      try {
        const body = await req.json();
        const { loadConfig, saveConfig } = await import("../config/loader");
        const { startChannel, stopChannel } = await import("./lifecycle");
        const config = await loadConfig();

        if (!config.channels) (config as any).channels = {};

        // Read current config to preserve masked/empty password fields
        const currentRaw = JSON.parse(readFileSync(paths.config, "utf-8"));
        const currentCh = currentRaw.channels?.[channelName] || {};

        // Merge — preserve existing secrets if masked values are sent back
        const merged = { ...body };
        if (channelName === "telegram" || channelName === "discord") {
          if (!merged.botToken || merged.botToken.includes("...")) {
            merged.botToken = currentCh.botToken || "";
          }
        }
        if (channelName === "slack") {
          if (!merged.botToken || merged.botToken.includes("...")) merged.botToken = currentCh.botToken || "";
          if (!merged.appToken || merged.appToken.includes("...")) merged.appToken = currentCh.appToken || "";
        }
        if (channelName === "email") {
          if (merged.imap?.password && merged.imap.password.includes("...")) {
            merged.imap.password = currentCh.imap?.password || "";
          }
          if (merged.smtp?.password && merged.smtp.password.includes("...")) {
            merged.smtp.password = currentCh.smtp?.password || "";
          }
        }

        (config.channels as any)[channelName] = merged;
        await saveConfig(config);

        // Hot-start/stop based on enabled flag
        const enabled = merged.enabled !== false;
        const router = (globalThis as any).__zuboRouter;
        if (router) {
          if (enabled) {
            // Reload config for startChannel since we just saved
            const freshConfig = await loadConfig();
            await startChannel(channelName, freshConfig, router);
          } else {
            await stopChannel(channelName, router);
          }
        }

        return Response.json({ ok: true, channel: channelName, enabled });
      } catch (err: any) {
        return Response.json({ error: err.message }, { status: 500 });
      }
    })() as any;
  }

  // PUT /api/dashboard/channels/:name/toggle — enable/disable channel
  const channelToggleMatch = path.match(/^\/channels\/([a-z]+)\/toggle$/);
  if (channelToggleMatch && req.method === "PUT") {
    const channelName = channelToggleMatch[1];
    return (async () => {
      try {
        const body = await req.json();
        const enabled = !!body.enabled;
        const { loadConfig, saveConfig } = await import("../config/loader");
        const { startChannel, stopChannel } = await import("./lifecycle");
        const config = await loadConfig();

        if (!config.channels) (config as any).channels = {};
        if (!(config.channels as any)[channelName]) {
          return Response.json({ error: "Channel not configured" }, { status: 400 });
        }
        (config.channels as any)[channelName].enabled = enabled;
        await saveConfig(config);

        const router = (globalThis as any).__zuboRouter;
        if (router) {
          if (enabled) {
            const freshConfig = await loadConfig();
            await startChannel(channelName, freshConfig, router);
          } else {
            await stopChannel(channelName, router);
          }
        }

        return Response.json({ ok: true, channel: channelName, enabled });
      } catch (err: any) {
        return Response.json({ error: err.message }, { status: 500 });
      }
    })() as any;
  }

  // --- LLM Provider Endpoints ---

  // GET /api/dashboard/providers — list all providers with masked keys
  if (path === "/providers" && req.method === "GET") {
    return (async () => {
      try {
        const { maskToken } = await import("../util/mask");
        const config = JSON.parse(readFileSync(paths.config, "utf-8"));
        const providers: any[] = [];

        if (config.providers) {
          for (const [name, p] of Object.entries(config.providers) as [string, any][]) {
            providers.push({
              name,
              model: p.model ?? "",
              apiKey: p.apiKey ? maskToken(p.apiKey) : "",
              baseUrl: p.baseUrl ?? "",
              contextWindow: p.contextWindow,
              streaming: p.streaming,
            });
          }
        }

        // Legacy provider
        if (config.anthropicApiKey && !providers.find(p => p.name === "anthropic")) {
          providers.push({
            name: "anthropic",
            model: config.model ?? "claude-sonnet-4-5-20250929",
            apiKey: maskToken(config.anthropicApiKey),
            baseUrl: "",
          });
        }

        return Response.json({
          providers,
          activeProvider: config.activeProvider ?? (config.anthropicApiKey ? "anthropic" : ""),
          failover: config.failover ?? [],
        });
      } catch (err: any) {
        return Response.json({ error: err.message }, { status: 500 });
      }
    })() as any;
  }

  // PUT /api/dashboard/providers/:name — add or update a provider
  const providerPutMatch = path.match(/^\/providers\/([a-z0-9_-]+)$/);
  if (providerPutMatch && req.method === "PUT" && path !== "/providers/active" && path !== "/providers/failover") {
    const providerName = providerPutMatch[1];
    return (async () => {
      try {
        const body = await req.json();
        const { loadConfig, saveConfig } = await import("../config/loader");
        const config = await loadConfig();

        if (!config.providers) (config as any).providers = {};

        // Preserve existing API key if masked value sent back
        const existing = (config.providers as any)?.[providerName];
        if (body.apiKey && body.apiKey.includes("...") && existing?.apiKey) {
          body.apiKey = existing.apiKey;
        }

        (config.providers as any)[providerName] = {
          ...(existing || {}),
          ...body,
        };

        // Set as active if first provider
        if (!config.activeProvider) {
          (config as any).activeProvider = providerName;
        }

        await saveConfig(config);
        return Response.json({ ok: true, provider: providerName });
      } catch (err: any) {
        return Response.json({ error: err.message }, { status: 500 });
      }
    })() as any;
  }

  // DELETE /api/dashboard/providers/:name — remove a provider
  const providerDelMatch = path.match(/^\/providers\/([a-z0-9_-]+)$/);
  if (providerDelMatch && req.method === "DELETE") {
    const providerName = providerDelMatch[1];
    return (async () => {
      try {
        const { loadConfig, saveConfig } = await import("../config/loader");
        const config = await loadConfig();
        if (config.providers) {
          delete (config.providers as any)[providerName];
        }
        // Remove from failover if present
        if (config.failover) {
          (config as any).failover = config.failover.filter(f => f !== providerName);
        }
        // If this was active, switch to first remaining
        if (config.activeProvider === providerName) {
          const remaining = Object.keys(config.providers || {});
          (config as any).activeProvider = remaining[0] || "";
        }
        await saveConfig(config);
        return Response.json({ ok: true, deleted: providerName });
      } catch (err: any) {
        return Response.json({ error: err.message }, { status: 500 });
      }
    })() as any;
  }

  // PUT /api/dashboard/providers/active — switch active provider + hot-reload
  if (path === "/providers/active" && req.method === "PUT") {
    return (async () => {
      try {
        const body = await req.json();
        const providerName = body.provider;
        if (!providerName) {
          return Response.json({ error: "provider is required" }, { status: 400 });
        }

        const { loadConfig, saveConfig } = await import("../config/loader");
        const { createProvider } = await import("../llm/factory");
        const config = await loadConfig();

        if (!config.providers?.[providerName]) {
          return Response.json({ error: `Provider "${providerName}" not configured` }, { status: 400 });
        }

        (config as any).activeProvider = providerName;
        await saveConfig(config);

        // Hot-reload: create new LLM and swap into router
        const router = (globalThis as any).__zuboRouter;
        if (router) {
          const freshConfig = await loadConfig();
          const newLlm = createProvider(freshConfig);
          router.setLlm(newLlm);
        }

        return Response.json({ ok: true, activeProvider: providerName });
      } catch (err: any) {
        return Response.json({ error: err.message }, { status: 500 });
      }
    })() as any;
  }

  // PUT /api/dashboard/providers/failover — update failover order
  if (path === "/providers/failover" && req.method === "PUT") {
    return (async () => {
      try {
        const body = await req.json();
        const { loadConfig, saveConfig } = await import("../config/loader");
        const config = await loadConfig();
        (config as any).failover = body.failover || [];
        await saveConfig(config);
        return Response.json({ ok: true, failover: config.failover });
      } catch (err: any) {
        return Response.json({ error: err.message }, { status: 500 });
      }
    })() as any;
  }

  // --- MCP Server Endpoints ---

  // GET /api/dashboard/mcp/servers — list MCP servers + status
  if (path === "/mcp/servers" && req.method === "GET") {
    return (async () => {
      try {
        const { getMcpStatus } = await import("../tools/mcp-client");
        const config = JSON.parse(readFileSync(paths.config, "utf-8"));
        const statusList = getMcpStatus();
        const statusMap: Record<string, { connected: boolean; tools: number }> = {};
        statusList.forEach(s => { statusMap[s.name] = { connected: s.connected, tools: s.tools }; });

        const servers = (config.mcp?.servers || []).map((s: any) => ({
          name: s.name,
          command: s.command,
          args: s.args || [],
          env: s.env ? Object.keys(s.env) : [],
          enabled: s.enabled !== false,
          connected: statusMap[s.name]?.connected ?? false,
          tools: statusMap[s.name]?.tools ?? 0,
        }));

        return Response.json({ servers });
      } catch (err: any) {
        return Response.json({ error: err.message }, { status: 500 });
      }
    })() as any;
  }

  // POST /api/dashboard/mcp/servers — add new MCP server + hot-connect
  if (path === "/mcp/servers" && req.method === "POST") {
    return (async () => {
      try {
        const body = await req.json();
        if (!body.name || !body.command) {
          return Response.json({ error: "name and command are required" }, { status: 400 });
        }

        const { loadConfig, saveConfig } = await import("../config/loader");
        const { connectMcpServer } = await import("../tools/mcp-client");
        const config = await loadConfig();

        if (!config.mcp) (config as any).mcp = { servers: [] };
        if (!config.mcp!.servers) (config.mcp as any).servers = [];

        // Remove existing with same name
        (config.mcp!.servers as any[]) = config.mcp!.servers.filter(
          (s: any) => s.name !== body.name
        );

        const serverConfig = {
          name: body.name,
          command: body.command,
          args: body.args || [],
          env: body.env || {},
          enabled: body.enabled !== false,
        };
        config.mcp!.servers.push(serverConfig);
        await saveConfig(config);

        // Hot-connect
        if (serverConfig.enabled) {
          try {
            await connectMcpServer(serverConfig);
          } catch (err: any) {
            return Response.json({ ok: true, connected: false, error: err.message });
          }
        }

        return Response.json({ ok: true, connected: true, server: body.name });
      } catch (err: any) {
        return Response.json({ error: err.message }, { status: 500 });
      }
    })() as any;
  }

  // DELETE /api/dashboard/mcp/servers/:name — remove MCP server + hot-disconnect
  const mcpDeleteMatch = path.match(/^\/mcp\/servers\/([a-zA-Z0-9_-]+)$/);
  if (mcpDeleteMatch && req.method === "DELETE") {
    const serverName = decodeURIComponent(mcpDeleteMatch[1]);
    return (async () => {
      try {
        const { loadConfig, saveConfig } = await import("../config/loader");
        const { disconnectMcpServer } = await import("../tools/mcp-client");
        const config = await loadConfig();

        if (config.mcp?.servers) {
          (config.mcp.servers as any[]) = config.mcp.servers.filter(
            (s: any) => s.name !== serverName
          );
        }
        await saveConfig(config);

        // Hot-disconnect
        await disconnectMcpServer(serverName);

        return Response.json({ ok: true, deleted: serverName });
      } catch (err: any) {
        return Response.json({ error: err.message }, { status: 500 });
      }
    })() as any;
  }

  // POST /api/dashboard/mcp/servers/:name/restart — disconnect + reconnect
  const mcpRestartMatch = path.match(/^\/mcp\/servers\/([a-zA-Z0-9_-]+)\/restart$/);
  if (mcpRestartMatch && req.method === "POST") {
    const serverName = decodeURIComponent(mcpRestartMatch[1]);
    return (async () => {
      try {
        const { connectMcpServer, disconnectMcpServer } = await import("../tools/mcp-client");
        const config = JSON.parse(readFileSync(paths.config, "utf-8"));
        const serverConfig = (config.mcp?.servers || []).find(
          (s: any) => s.name === serverName
        );
        if (!serverConfig) {
          return Response.json({ error: "Server not found" }, { status: 404 });
        }

        await disconnectMcpServer(serverName);
        await connectMcpServer(serverConfig);

        return Response.json({ ok: true, restarted: serverName });
      } catch (err: any) {
        return Response.json({ error: err.message }, { status: 500 });
      }
    })() as any;
  }

  // ─── Conversation History ─────────────────────────────────────────────────

  // GET /api/dashboard/conversations — list all conversations
  if (path === "/conversations" && req.method === "GET") {
    try {
      const db = getDb();
      const page = parseInt(url.searchParams.get("page") ?? "1", 10);
      const limit = Math.min(parseInt(url.searchParams.get("limit") ?? "20", 10), 100);
      const channelFilter = url.searchParams.get("channel");
      const offset = (page - 1) * limit;

      let query = "SELECT id, title, channel, message_count, summary, created_at, updated_at FROM threads";
      const params: any[] = [];
      if (channelFilter) {
        query += " WHERE channel = ?";
        params.push(channelFilter);
      }
      query += " ORDER BY updated_at DESC LIMIT ? OFFSET ?";
      params.push(limit, offset);

      const threads = db.query(query).all(...params);

      let countQuery = "SELECT COUNT(*) as total FROM threads";
      const total = channelFilter
        ? (db.query(countQuery + " WHERE channel = ?").get(channelFilter) as any)?.total ?? 0
        : (db.query(countQuery).get() as any)?.total ?? 0;

      return Response.json({ conversations: threads, total, page, limit });
    } catch (err: any) {
      return Response.json({ conversations: [], total: 0, error: err.message });
    }
  }

  // GET /api/dashboard/conversations/search — FTS search
  if (path === "/conversations/search" && req.method === "GET") {
    try {
      const q = url.searchParams.get("q") ?? "";
      const limit = Math.min(parseInt(url.searchParams.get("limit") ?? "20", 10), 100);
      const { searchConversations } = await import("../agent/history");
      const results = searchConversations(q, limit);
      return Response.json({ results });
    } catch (err: any) {
      return Response.json({ results: [], error: err.message });
    }
  }

  // GET /api/dashboard/conversations/stats — aggregate stats
  if (path === "/conversations/stats" && req.method === "GET") {
    try {
      const { getConversationStats } = await import("../agent/history");
      return Response.json(getConversationStats());
    } catch (err: any) {
      return Response.json({ totalConversations: 0, totalMessages: 0, messagesByChannel: [], recentActivity: [], error: err.message });
    }
  }

  // GET /api/dashboard/conversations/:id/messages — get messages for a conversation
  const convMsgMatch = path.match(/^\/conversations\/([^/]+)\/messages$/);
  if (convMsgMatch && req.method === "GET") {
    const threadId = decodeURIComponent(convMsgMatch[1]);
    try {
      const db = getDb();
      const limit = Math.min(parseInt(url.searchParams.get("limit") ?? "50", 10), 200);
      const before = url.searchParams.get("before");

      let query = "SELECT id, role, content, channel, timestamp FROM conversation_messages WHERE thread_id = ?";
      const params: any[] = [threadId];
      if (before) {
        query += " AND timestamp < ?";
        params.push(before);
      }
      query += " ORDER BY timestamp DESC LIMIT ?";
      params.push(limit);

      const messages = db.query(query).all(...params);
      return Response.json({ messages: (messages as any[]).reverse() });
    } catch (err: any) {
      // Fallback to JSONL session file
      try {
        const { loadSession } = await import("../agent/session");
        const messages = loadSession(threadId, 50);
        return Response.json({ messages });
      } catch {
        return Response.json({ messages: [], error: err.message });
      }
    }
  }

  // ─── Email Digests ────────────────────────────────────────────────────────

  // GET /api/dashboard/digests/config
  if (path === "/digests/config" && req.method === "GET") {
    try {
      const db = getDb();
      const config = db.query("SELECT * FROM email_digest_config WHERE id = 1").get() as any;
      if (!config) return Response.json({ enabled: false, frequency: "daily", send_time: "09:00", email_to: "", include_conversations: true, include_tool_usage: true, include_errors: true, include_scheduled_tasks: true });
      return Response.json({
        enabled: !!config.enabled,
        frequency: config.frequency,
        send_time: config.send_time,
        email_to: config.email_to ?? "",
        include_conversations: !!config.include_conversations,
        include_tool_usage: !!config.include_tool_usage,
        include_errors: !!config.include_errors,
        include_scheduled_tasks: !!config.include_scheduled_tasks,
        last_sent_at: config.last_sent_at,
      });
    } catch (err: any) {
      return Response.json({ enabled: false, frequency: "daily", send_time: "09:00", email_to: "", error: err.message });
    }
  }

  // PUT /api/dashboard/digests/config
  if (path === "/digests/config" && req.method === "PUT") {
    return (async () => {
      try {
        const body = await req.json() as any;
        const db = getDb();
        db.prepare(`
          UPDATE email_digest_config SET
            enabled = ?, frequency = ?, send_time = ?, email_to = ?,
            include_conversations = ?, include_tool_usage = ?,
            include_errors = ?, include_scheduled_tasks = ?
          WHERE id = 1
        `).run(
          body.enabled ? 1 : 0,
          body.frequency ?? "daily",
          body.send_time ?? "09:00",
          body.email_to ?? "",
          body.include_conversations ? 1 : 0,
          body.include_tool_usage ? 1 : 0,
          body.include_errors ? 1 : 0,
          body.include_scheduled_tasks ? 1 : 0
        );
        // Reschedule
        const { scheduleDigest, unscheduleDigest } = await import("../scheduler/digest");
        unscheduleDigest();
        if (body.enabled) scheduleDigest();
        return Response.json({ ok: true });
      } catch (err: any) {
        return Response.json({ error: err.message }, { status: 500 });
      }
    })() as any;
  }

  // GET /api/dashboard/digests/preview
  if (path === "/digests/preview" && req.method === "GET") {
    return (async () => {
      try {
        const { generateDigest } = await import("../scheduler/digest");
        const since = new Date(Date.now() - 24 * 60 * 60 * 1000);
        const html = generateDigest(since);
        return new Response(html, { headers: { "Content-Type": "text/html" } });
      } catch (err: any) {
        return Response.json({ error: err.message }, { status: 500 });
      }
    })() as any;
  }

  // POST /api/dashboard/digests/send
  if (path === "/digests/send" && req.method === "POST") {
    return (async () => {
      try {
        const { sendDigest } = await import("../scheduler/digest");
        await sendDigest();
        return Response.json({ ok: true });
      } catch (err: any) {
        return Response.json({ error: err.message }, { status: 500 });
      }
    })() as any;
  }

  // ─── Enhanced Webhooks ────────────────────────────────────────────────────

  // GET /api/dashboard/webhooks — list all with stats
  if (path === "/webhooks" && req.method === "GET") {
    try {
      const db = getDb();
      const webhooks = db.query(`
        SELECT w.id, w.name, w.description, w.active, w.prompt_template,
               w.last_triggered_at, w.trigger_count, w.created_at,
               (SELECT COUNT(*) FROM webhook_events WHERE webhook_id = w.id) as event_count
        FROM webhooks w ORDER BY w.created_at DESC
      `).all();
      return Response.json({ webhooks });
    } catch (err: any) {
      return Response.json({ webhooks: [], error: err.message });
    }
  }

  // POST /api/dashboard/webhooks — create
  if (path === "/webhooks" && req.method === "POST") {
    return (async () => {
      try {
        const body = await req.json() as any;
        if (!body.name || !/^[a-zA-Z0-9_-]+$/.test(body.name)) {
          return Response.json({ error: "Name must be alphanumeric with hyphens/underscores" }, { status: 400 });
        }
        const db = getDb();
        const id = crypto.randomUUID();
        db.prepare(
          "INSERT INTO webhooks (id, name, description, secret, prompt_template) VALUES (?, ?, ?, ?, ?)"
        ).run(id, body.name, body.description ?? "", body.secret ?? null, body.prompt_template ?? null);
        return Response.json({ ok: true, id, name: body.name, url: `/api/webhook/${id}` });
      } catch (err: any) {
        return Response.json({ error: err.message }, { status: 500 });
      }
    })() as any;
  }

  // PUT /api/dashboard/webhooks/:id — update
  const webhookUpdateMatch = path.match(/^\/webhooks\/([a-f0-9-]+)$/);
  if (webhookUpdateMatch && req.method === "PUT") {
    const webhookId = webhookUpdateMatch[1];
    return (async () => {
      try {
        const body = await req.json() as any;
        const db = getDb();
        const sets: string[] = [];
        const params: any[] = [];
        if (body.name !== undefined) { sets.push("name = ?"); params.push(body.name); }
        if (body.description !== undefined) { sets.push("description = ?"); params.push(body.description); }
        if (body.secret !== undefined) { sets.push("secret = ?"); params.push(body.secret || null); }
        if (body.prompt_template !== undefined) { sets.push("prompt_template = ?"); params.push(body.prompt_template || null); }
        if (typeof body.active === "boolean") { sets.push("active = ?"); params.push(body.active ? 1 : 0); }
        if (!sets.length) return Response.json({ ok: true });
        params.push(webhookId);
        db.prepare(`UPDATE webhooks SET ${sets.join(", ")} WHERE id = ?`).run(...params);
        return Response.json({ ok: true });
      } catch (err: any) {
        return Response.json({ error: err.message }, { status: 500 });
      }
    })() as any;
  }

  // DELETE /api/dashboard/webhooks/:id
  const webhookDeleteMatch = path.match(/^\/webhooks\/([a-f0-9-]+)$/);
  if (webhookDeleteMatch && req.method === "DELETE") {
    const webhookId = webhookDeleteMatch[1];
    try {
      const db = getDb();
      db.prepare("DELETE FROM webhook_events WHERE webhook_id = ?").run(webhookId);
      db.prepare("DELETE FROM webhooks WHERE id = ?").run(webhookId);
      return Response.json({ ok: true });
    } catch (err: any) {
      return Response.json({ error: err.message }, { status: 500 });
    }
  }

  // GET /api/dashboard/webhooks/:id/events
  const webhookEventsMatch = path.match(/^\/webhooks\/([a-f0-9-]+)\/events$/);
  if (webhookEventsMatch && req.method === "GET") {
    const webhookId = webhookEventsMatch[1];
    try {
      const db = getDb();
      const limit = Math.min(parseInt(url.searchParams.get("limit") ?? "20", 10), 100);
      const events = db.query(
        "SELECT id, payload, headers, processed, created_at FROM webhook_events WHERE webhook_id = ? ORDER BY created_at DESC LIMIT ?"
      ).all(webhookId, limit);
      return Response.json({ events });
    } catch (err: any) {
      return Response.json({ events: [], error: err.message });
    }
  }

  // POST /api/dashboard/webhooks/:id/test — send test payload
  const webhookTestMatch = path.match(/^\/webhooks\/([a-f0-9-]+)\/test$/);
  if (webhookTestMatch && req.method === "POST") {
    const webhookId = webhookTestMatch[1];
    return (async () => {
      try {
        const db = getDb();
        const webhook = db.query("SELECT id, name, active, prompt_template FROM webhooks WHERE id = ?").get(webhookId) as any;
        if (!webhook) return Response.json({ error: "Webhook not found" }, { status: 404 });

        const testPayload = { test: true, timestamp: new Date().toISOString(), source: "dashboard" };
        db.prepare("INSERT INTO webhook_events (webhook_id, payload, headers) VALUES (?, ?, ?)").run(
          webhookId, JSON.stringify(testPayload), "{}"
        );

        // Trigger agent
        let message: string;
        if (webhook.prompt_template) {
          message = webhook.prompt_template.replace(/\{\{payload\}\}/g, JSON.stringify(testPayload));
        } else {
          message = `[Webhook: ${webhook.name}] Test event: ${JSON.stringify(testPayload)}`;
        }

        db.prepare("UPDATE webhooks SET last_triggered_at = datetime('now'), trigger_count = trigger_count + 1 WHERE id = ?").run(webhookId);
        return Response.json({ ok: true, message });
      } catch (err: any) {
        return Response.json({ error: err.message }, { status: 500 });
      }
    })() as any;
  }

  // ─── MCP Marketplace ──────────────────────────────────────────────────────

  // GET /api/dashboard/mcp/marketplace — search/browse registry
  if (path === "/mcp/marketplace" && req.method === "GET") {
    return (async () => {
      try {
        const q = url.searchParams.get("q") ?? "";
        const cursor = url.searchParams.get("cursor") ?? undefined;
        const limit = Math.min(parseInt(url.searchParams.get("limit") ?? "20", 10), 50);
        const { searchRegistry, listRegistry } = await import("../tools/mcp-registry");
        if (q) {
          const results = await searchRegistry(q, limit);
          return Response.json({ servers: results });
        } else {
          const result = await listRegistry(cursor, limit);
          return Response.json(result);
        }
      } catch (err: any) {
        return Response.json({ servers: [], error: err.message });
      }
    })() as any;
  }

  // GET /api/dashboard/mcp/marketplace/:name — detail
  const mcpMarketDetailMatch = path.match(/^\/mcp\/marketplace\/(.+)$/);
  if (mcpMarketDetailMatch && req.method === "GET") {
    const serverName = decodeURIComponent(mcpMarketDetailMatch[1]);
    return (async () => {
      try {
        const { getServerDetail } = await import("../tools/mcp-registry");
        const detail = await getServerDetail(serverName);
        if (!detail) return Response.json({ error: "Server not found" }, { status: 404 });
        return Response.json(detail);
      } catch (err: any) {
        return Response.json({ error: err.message }, { status: 500 });
      }
    })() as any;
  }

  // POST /api/dashboard/mcp/marketplace/:name/install
  const mcpInstallMatch = path.match(/^\/mcp\/marketplace\/(.+)\/install$/);
  if (mcpInstallMatch && req.method === "POST") {
    const serverName = decodeURIComponent(mcpInstallMatch[1]);
    return (async () => {
      try {
        const { installFromRegistry } = await import("../tools/mcp-registry");
        const result = await installFromRegistry(serverName);
        return Response.json({ ok: true, ...result });
      } catch (err: any) {
        return Response.json({ error: err.message }, { status: 500 });
      }
    })() as any;
  }

  // POST /api/dashboard/mcp/servers/:name/uninstall
  const mcpUninstallMatch = path.match(/^\/mcp\/servers\/([a-zA-Z0-9_-]+)\/uninstall$/);
  if (mcpUninstallMatch && req.method === "POST") {
    const serverName = decodeURIComponent(mcpUninstallMatch[1]);
    return (async () => {
      try {
        const { uninstallMcpServer } = await import("../tools/mcp-registry");
        await uninstallMcpServer(serverName);
        return Response.json({ ok: true, uninstalled: serverName });
      } catch (err: any) {
        return Response.json({ error: err.message }, { status: 500 });
      }
    })() as any;
  }

  // ─── Visual Workflows ─────────────────────────────────────────────────────

  // GET /api/dashboard/visual-workflows — list all
  if (path === "/visual-workflows" && req.method === "GET") {
    try {
      const db = getDb();
      const workflows = db.query(
        "SELECT id, name, description, trigger_type, enabled, run_count, last_run_at, created_at, updated_at FROM visual_workflows ORDER BY updated_at DESC"
      ).all();
      return Response.json({ workflows });
    } catch (err: any) {
      return Response.json({ workflows: [], error: err.message });
    }
  }

  // POST /api/dashboard/visual-workflows — create
  if (path === "/visual-workflows" && req.method === "POST") {
    return (async () => {
      try {
        const body = await req.json() as any;
        if (!body.name) return Response.json({ error: "Name required" }, { status: 400 });
        const db = getDb();
        const id = crypto.randomUUID();
        db.prepare(
          "INSERT INTO visual_workflows (id, name, description, trigger_type, trigger_config, steps, canvas_data) VALUES (?, ?, ?, ?, ?, ?, ?)"
        ).run(
          id, body.name, body.description ?? "",
          body.trigger_type ?? "manual",
          JSON.stringify(body.trigger_config ?? {}),
          JSON.stringify(body.steps ?? []),
          JSON.stringify(body.canvas_data ?? null)
        );
        return Response.json({ ok: true, id });
      } catch (err: any) {
        return Response.json({ error: err.message }, { status: 500 });
      }
    })() as any;
  }

  // GET /api/dashboard/visual-workflows/:id
  const vwGetMatch = path.match(/^\/visual-workflows\/([a-f0-9-]+)$/);
  if (vwGetMatch && req.method === "GET") {
    const wfId = vwGetMatch[1];
    try {
      const db = getDb();
      const wf = db.query("SELECT * FROM visual_workflows WHERE id = ?").get(wfId);
      if (!wf) return Response.json({ error: "Not found" }, { status: 404 });
      return Response.json(wf);
    } catch (err: any) {
      return Response.json({ error: err.message }, { status: 500 });
    }
  }

  // PUT /api/dashboard/visual-workflows/:id
  const vwUpdateMatch = path.match(/^\/visual-workflows\/([a-f0-9-]+)$/);
  if (vwUpdateMatch && req.method === "PUT") {
    const wfId = vwUpdateMatch[1];
    return (async () => {
      try {
        const body = await req.json() as any;
        const db = getDb();
        db.prepare(`
          UPDATE visual_workflows SET
            name = COALESCE(?, name),
            description = COALESCE(?, description),
            trigger_type = COALESCE(?, trigger_type),
            trigger_config = COALESCE(?, trigger_config),
            steps = COALESCE(?, steps),
            canvas_data = COALESCE(?, canvas_data),
            updated_at = datetime('now')
          WHERE id = ?
        `).run(
          body.name ?? null, body.description ?? null,
          body.trigger_type ?? null,
          body.trigger_config ? JSON.stringify(body.trigger_config) : null,
          body.steps ? JSON.stringify(body.steps) : null,
          body.canvas_data ? JSON.stringify(body.canvas_data) : null,
          wfId
        );
        // Re-register triggers if needed
        try {
          const { registerWorkflowTriggers, unregisterWorkflowTriggers } = await import("../scheduler/visual-workflows");
          unregisterWorkflowTriggers();
          registerWorkflowTriggers();
        } catch {}
        return Response.json({ ok: true });
      } catch (err: any) {
        return Response.json({ error: err.message }, { status: 500 });
      }
    })() as any;
  }

  // DELETE /api/dashboard/visual-workflows/:id
  const vwDeleteMatch = path.match(/^\/visual-workflows\/([a-f0-9-]+)$/);
  if (vwDeleteMatch && req.method === "DELETE") {
    const wfId = vwDeleteMatch[1];
    try {
      const db = getDb();
      db.prepare("DELETE FROM visual_workflows WHERE id = ?").run(wfId);
      return Response.json({ ok: true });
    } catch (err: any) {
      return Response.json({ error: err.message }, { status: 500 });
    }
  }

  // POST /api/dashboard/visual-workflows/:id/run — manual trigger
  const vwRunMatch = path.match(/^\/visual-workflows\/([a-f0-9-]+)\/run$/);
  if (vwRunMatch && req.method === "POST") {
    const wfId = vwRunMatch[1];
    return (async () => {
      try {
        const { executeVisualWorkflow } = await import("../scheduler/visual-workflows");
        const result = await executeVisualWorkflow(wfId);
        return Response.json(result);
      } catch (err: any) {
        return Response.json({ error: err.message }, { status: 500 });
      }
    })() as any;
  }

  // PUT /api/dashboard/visual-workflows/:id/toggle
  const vwToggleMatch = path.match(/^\/visual-workflows\/([a-f0-9-]+)\/toggle$/);
  if (vwToggleMatch && req.method === "PUT") {
    const wfId = vwToggleMatch[1];
    return (async () => {
      try {
        const body = await req.json() as any;
        const db = getDb();
        db.prepare("UPDATE visual_workflows SET enabled = ?, updated_at = datetime('now') WHERE id = ?").run(
          body.enabled ? 1 : 0, wfId
        );
        // Re-register cron triggers
        try {
          const { registerWorkflowTriggers, unregisterWorkflowTriggers } = await import("../scheduler/visual-workflows");
          unregisterWorkflowTriggers();
          registerWorkflowTriggers();
        } catch {}
        return Response.json({ ok: true, enabled: !!body.enabled });
      } catch (err: any) {
        return Response.json({ error: err.message }, { status: 500 });
      }
    })() as any;
  }

  // GET /api/dashboard/visual-workflows/:id/executions
  const vwExecMatch = path.match(/^\/visual-workflows\/([a-f0-9-]+)\/executions$/);
  if (vwExecMatch && req.method === "GET") {
    const wfId = vwExecMatch[1];
    try {
      const db = getDb();
      const wf = db.query("SELECT name FROM visual_workflows WHERE id = ?").get(wfId) as any;
      if (!wf) return Response.json({ error: "Not found" }, { status: 404 });
      const executions = db.query(
        "SELECT * FROM workflow_executions WHERE workflow_name = ? ORDER BY started_at DESC LIMIT 20"
      ).all(wf.name);
      return Response.json({ executions });
    } catch (err: any) {
      return Response.json({ executions: [], error: err.message });
    }
  }

  return null;
}

export interface WebChatAdapter extends ChannelAdapter {
  getPort(): number;
}

// Cached config values — refreshed every 30s to avoid reading disk on every request
let _cachedRateLimit: { chatPerMinute: number; uploadPerMinute: number } | null = null;
let _cachedAuthEnabled: boolean | null = null;
let _configCacheTime = 0;
const CONFIG_CACHE_TTL = 30_000;

function refreshConfigCache(): void {
  const now = Date.now();
  if (_cachedRateLimit !== null && now - _configCacheTime < CONFIG_CACHE_TTL) return;
  _configCacheTime = now;
  try {
    const config = JSON.parse(readFileSync(paths.config, "utf-8"));
    _cachedRateLimit = {
      chatPerMinute: config.rateLimit?.chatPerMinute ?? 60,
      uploadPerMinute: config.rateLimit?.uploadPerMinute ?? 10,
    };
    _cachedAuthEnabled = config.auth?.enabled === true;
  } catch {
    _cachedRateLimit = { chatPerMinute: 60, uploadPerMinute: 10 };
    _cachedAuthEnabled = false;
  }
}

function getRateLimitConfig(): { chatPerMinute: number; uploadPerMinute: number } {
  refreshConfigCache();
  return _cachedRateLimit!;
}

function isAuthEnabled(): boolean {
  refreshConfigCache();
  return _cachedAuthEnabled!;
}

function getClientIp(req: Request, server: any): string {
  // Prefer actual connection IP from Bun server to prevent header spoofing
  try {
    const addr = server?.requestIP?.(req);
    if (addr?.address) return addr.address;
  } catch (err: any) {
    logger.warn("Failed to get client IP from server", { error: (err as Error).message });
  }
  // No trusted proxy configured — do not trust X-Forwarded-For header
  return "127.0.0.1";
}

export function createWebChatAdapter(
  port: number,
  router: MessageRouter
): WebChatAdapter {
  let server: ReturnType<typeof Bun.serve> | null = null;
  const sessionKey = "webchat:local";

  const rlConfig = getRateLimitConfig();
  const chatLimiter = new RateLimiter(rlConfig.chatPerMinute, 60_000);
  const uploadLimiter = new RateLimiter(rlConfig.uploadPerMinute, 60_000);

  return {
    channelName: "webchat",

    getPort() {
      return server?.port ?? port;
    },

    start() {
      // Ensure threads table exists
      try {
        const db = getDb();
        db.run(`CREATE TABLE IF NOT EXISTS threads (
          id TEXT PRIMARY KEY,
          title TEXT NOT NULL DEFAULT 'New conversation',
          channel TEXT DEFAULT 'webchat',
          message_count INTEGER NOT NULL DEFAULT 0,
          summary TEXT,
          created_at TEXT NOT NULL DEFAULT (datetime('now')),
          updated_at TEXT NOT NULL DEFAULT (datetime('now'))
        )`);
        // Migrate existing tables missing new columns
        try { db.run("ALTER TABLE threads ADD COLUMN channel TEXT DEFAULT 'webchat'"); } catch {}
        try { db.run("ALTER TABLE threads ADD COLUMN message_count INTEGER NOT NULL DEFAULT 0"); } catch {}
        try { db.run("ALTER TABLE threads ADD COLUMN summary TEXT"); } catch {}
        // Backfill threads from conversation_messages for pre-existing data
        try {
          db.run(`INSERT OR IGNORE INTO threads (id, title, channel, message_count, created_at, updated_at)
            SELECT thread_id, thread_id, COALESCE(channel, 'webchat'),
              COUNT(*), MIN(timestamp), MAX(timestamp)
            FROM conversation_messages GROUP BY thread_id`);
        } catch {}
      } catch (err: any) {
        logger.warn("Failed to create threads table", { error: (err as Error).message });
      }

      server = Bun.serve({
        port,
        hostname: "127.0.0.1", // Bind to localhost only — prevents network exposure
        idleTimeout: 120,
        async fetch(req) {
          const response = await handleRequest(req, router, sessionKey, chatLimiter, uploadLimiter, server, port);
          return addSecurityHeaders(response);
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

async function handleRequest(
  req: Request,
  router: MessageRouter,
  sessionKey: string,
  chatLimiter: RateLimiter,
  uploadLimiter: RateLimiter,
  server: ReturnType<typeof Bun.serve> | null,
  port: number
): Promise<Response> {
          const url = new URL(req.url);

          // CORS protection: reject cross-origin API requests
          if (url.pathname.startsWith("/api/")) {
            const origin = req.headers.get("origin");
            if (origin) {
              const actualPort = server?.port ?? port;
              const allowed = [
                `http://localhost:${actualPort}`,
                `http://127.0.0.1:${actualPort}`,
              ];
              if (!allowed.includes(origin)) {
                return Response.json({ error: "Cross-origin requests are not allowed" }, { status: 403 });
              }
            }
          }

          // Health check
          if (url.pathname === "/health") {
            return Response.json({ status: "ok", uptime: Math.floor(process.uptime()) });
          }

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

          // --- OAuth routes ---

          // GET /oauth/:provider/authorize — redirect user to provider's auth page (requires session key)
          const ALLOWED_OAUTH_PROVIDERS = new Set(["google", "github", "notion", "linear", "slack"]);
          if (url.pathname.match(/^\/oauth\/[a-z]+\/authorize$/) && req.method === "GET") {
            const provider = url.pathname.split("/")[2];
            if (!ALLOWED_OAUTH_PROVIDERS.has(provider)) {
              return Response.json({ error: "Unknown OAuth provider" }, { status: 400 });
            }
            // Require session key to prevent unauthorized OAuth initiation
            const sk = url.searchParams.get("sk");
            if (sk !== sessionKey) {
              return Response.json({ error: "Unauthorized" }, { status: 401 });
            }
            try {
              const { getAuthUrl } = await import("../tools/oauth");
              const actualPort = server?.port ?? port;
              const redirectUri = `http://localhost:${actualPort}/oauth/${provider}/callback`;
              const { url: authUrl } = await getAuthUrl(provider, redirectUri);
              return new Response(null, {
                status: 302,
                headers: { Location: authUrl },
              });
            } catch (err: any) {
              return new Response(
                `<html><body><h2>OAuth Error</h2><p>${escapeHtml(err.message)}</p><p><a href="/">Back to dashboard</a></p></body></html>`,
                { status: 400, headers: { "Content-Type": "text/html" } }
              );
            }
          }

          // GET /oauth/:provider/callback — handle callback from provider
          if (url.pathname.match(/^\/oauth\/[a-z]+\/callback$/) && req.method === "GET") {
            const provider = url.pathname.split("/")[2];
            const code = url.searchParams.get("code");
            const state = url.searchParams.get("state");
            const error = url.searchParams.get("error");

            if (error) {
              const errorDesc = url.searchParams.get("error_description") || error;
              return new Response(
                `<html><head><title>OAuth Error</title><style>body{font-family:system-ui;display:flex;align-items:center;justify-content:center;min-height:100vh;margin:0;background:#060608;color:#f0f0f5;}.card{background:#111116;border:1px solid #1e1e26;border-radius:12px;padding:32px;max-width:400px;text-align:center;}.err{color:#ef4444;}</style></head><body><div class="card"><h2 class="err">Authorization Failed</h2><p>${escapeHtml(errorDesc)}</p><p style="margin-top:16px"><a href="/" style="color:#7c3aed;">Back to Dashboard</a></p></div></body></html>`,
                { headers: { "Content-Type": "text/html" } }
              );
            }

            if (!code || !state) {
              return new Response(
                `<html><head><title>OAuth Error</title><style>body{font-family:system-ui;display:flex;align-items:center;justify-content:center;min-height:100vh;margin:0;background:#060608;color:#f0f0f5;}.card{background:#111116;border:1px solid #1e1e26;border-radius:12px;padding:32px;max-width:400px;text-align:center;}.err{color:#ef4444;}</style></head><body><div class="card"><h2 class="err">Missing Parameters</h2><p>Authorization code or state parameter is missing.</p><p style="margin-top:16px"><a href="/" style="color:#7c3aed;">Back to Dashboard</a></p></div></body></html>`,
                { status: 400, headers: { "Content-Type": "text/html" } }
              );
            }

            try {
              const { handleCallback } = await import("../tools/oauth");
              await handleCallback(provider, code, state);
              return new Response(
                `<html><head><title>Connected!</title><style>body{font-family:system-ui;display:flex;align-items:center;justify-content:center;min-height:100vh;margin:0;background:#060608;color:#f0f0f5;}.card{background:#111116;border:1px solid #1e1e26;border-radius:12px;padding:32px;max-width:400px;text-align:center;}.ok{color:#10b981;}</style></head><body><div class="card"><h2 class="ok">${provider.charAt(0).toUpperCase() + provider.slice(1)} Connected!</h2><p>You have successfully authorized ${provider}. This window will close automatically.</p><script>setTimeout(function(){window.close()},3000);</script><p style="margin-top:16px"><a href="/#integrations" style="color:#7c3aed;">Back to Dashboard</a></p></div></body></html>`,
                { headers: { "Content-Type": "text/html" } }
              );
            } catch (err: any) {
              return new Response(
                `<html><head><title>OAuth Error</title><style>body{font-family:system-ui;display:flex;align-items:center;justify-content:center;min-height:100vh;margin:0;background:#060608;color:#f0f0f5;}.card{background:#111116;border:1px solid #1e1e26;border-radius:12px;padding:32px;max-width:400px;text-align:center;}.err{color:#ef4444;}</style></head><body><div class="card"><h2 class="err">Connection Failed</h2><p>${escapeHtml(err.message)}</p><p style="margin-top:16px"><a href="/" style="color:#7c3aed;">Back to Dashboard</a></p></div></body></html>`,
                { status: 500, headers: { "Content-Type": "text/html" } }
              );
            }
          }

          // Health check (no auth required)
          if (url.pathname === "/api/health") {
            const uptime = process.uptime();
            let dbOk = false;
            try {
              getDb().query("SELECT 1").get();
              dbOk = true;
            } catch {}
            return Response.json({
              status: dbOk ? "healthy" : "degraded",
              uptime: Math.round(uptime),
              version: "0.1.0",
              db: dbOk ? "connected" : "error",
              timestamp: new Date().toISOString(),
            });
          }

          // Webhook ingress — no auth required (uses HMAC signature verification)
          if (url.pathname.startsWith("/api/webhook/") && req.method === "POST") {
            const webhookId = url.pathname.slice("/api/webhook/".length);
            if (!webhookId || !/^[a-f0-9-]+$/i.test(webhookId)) {
              return Response.json({ error: "Invalid webhook ID" }, { status: 400 });
            }
            return (async () => {
              try {
                const db = getDb();
                const webhook = db.query(
                  "SELECT id, name, secret, active, prompt_template FROM webhooks WHERE id = ?"
                ).get(webhookId) as { id: string; name: string; secret: string | null; active: number; prompt_template: string | null } | null;

                if (!webhook) {
                  return Response.json({ error: "Webhook not found" }, { status: 404 });
                }
                if (!webhook.active) {
                  return Response.json({ error: "Webhook is disabled" }, { status: 403 });
                }

                const rawBody = await req.text();

                // HMAC signature verification (if secret is configured)
                if (webhook.secret) {
                  const signature = req.headers.get("x-hub-signature-256")
                    || req.headers.get("x-webhook-secret");
                  if (!signature) {
                    return Response.json({ error: "Missing signature header" }, { status: 401 });
                  }
                  const encoder = new TextEncoder();
                  const key = await crypto.subtle.importKey(
                    "raw",
                    encoder.encode(webhook.secret),
                    { name: "HMAC", hash: "SHA-256" },
                    false,
                    ["sign"]
                  );
                  const sig = await crypto.subtle.sign("HMAC", key, encoder.encode(rawBody));
                  const expected = "sha256=" + Array.from(new Uint8Array(sig)).map(b => b.toString(16).padStart(2, "0")).join("");
                  const provided = signature.startsWith("sha256=") ? signature : `sha256=${signature}`;
                  // Timing-safe comparison to prevent signature extraction via timing attacks
                  const expectedBuf = Buffer.from(expected, "utf8");
                  const providedBuf = Buffer.from(provided, "utf8");
                  if (expectedBuf.length !== providedBuf.length || !crypto.timingSafeEqual(expectedBuf, providedBuf)) {
                    return Response.json({ error: "Invalid signature" }, { status: 401 });
                  }
                }

                // Store event
                const headersJson = JSON.stringify(Object.fromEntries(req.headers.entries()));
                db.prepare(
                  "INSERT INTO webhook_events (webhook_id, payload, headers) VALUES (?, ?, ?)"
                ).run(webhook.id, rawBody, headersJson);

                // Update trigger stats
                try {
                  db.prepare("UPDATE webhooks SET last_triggered_at = datetime('now'), trigger_count = trigger_count + 1 WHERE id = ?").run(webhook.id);
                } catch {}

                // Mark event as processed
                try {
                  const lastEvent = db.query("SELECT id FROM webhook_events WHERE webhook_id = ? ORDER BY id DESC LIMIT 1").get(webhook.id) as any;
                  if (lastEvent) db.prepare("UPDATE webhook_events SET processed = 1 WHERE id = ?").run(lastEvent.id);
                } catch {}

                // Trigger agent via router — use prompt_template if set
                let message: string;
                if (webhook.prompt_template) {
                  message = webhook.prompt_template.replace(/\{\{payload\}\}/g, rawBody.slice(0, 2000));
                } else {
                  const summary = rawBody.slice(0, 500);
                  message = `[Webhook: ${webhook.name}] Received event:\n${summary}`;
                }

                // Also trigger any visual workflows linked to this webhook
                import("../scheduler/visual-workflows").then(({ triggerByWebhook }) => {
                  triggerByWebhook(webhook.id, rawBody).catch(() => {});
                }).catch(() => {});

                router.sendProactive(`webchat:webhook`, message).catch((err: any) => {
                  logger.warn("Webhook proactive message failed", { error: err.message });
                });

                return Response.json({ ok: true, webhook: webhook.name });
              } catch (err: any) {
                return Response.json({ error: err.message }, { status: 500 });
              }
            })() as any;
          }

          // Serve generated images
          if (url.pathname.startsWith("/uploads/generated/") && req.method === "GET") {
            const filename = url.pathname.slice("/uploads/generated/".length);
            if (!filename || /[\/\\]/.test(filename)) {
              return new Response("Not Found", { status: 404 });
            }
            const { homedir } = await import("os");
            const filePath = join(homedir(), ".zubo", "uploads", "generated", filename);
            const file = Bun.file(filePath);
            if (await file.exists()) {
              return new Response(file, {
                headers: { "Content-Type": "image/png", "Cache-Control": "public, max-age=3600" },
              });
            }
            return new Response("Not Found", { status: 404 });
          }

          // Auth check for /api/* endpoints (if enabled) — runs BEFORE any API handler
          if (url.pathname.startsWith("/api/") && isAuthEnabled()) {
            const db = getDb();
            initAuth(db);
            if (!validateRequest(db, req)) {
              return Response.json(
                { error: "Unauthorized. Provide a valid API key via Authorization: Bearer <key>" },
                { status: 401, headers: { "WWW-Authenticate": "Bearer" } }
              );
            }
          }

          // Dashboard API
          if (url.pathname.startsWith("/api/dashboard")) {
            const result = await handleDashboardApi(url, req);
            if (result) return result;
          }

          // API key management endpoints
          if (url.pathname === "/api/keys" && req.method === "POST") {
            const db = getDb();
            initAuth(db);
            const body = (await req.json()) as { label?: string };
            const result = createApiKey(db, body.label ?? "");
            return Response.json(result, { status: 201 });
          }
          if (url.pathname === "/api/keys" && req.method === "GET") {
            const db = getDb();
            initAuth(db);
            return Response.json({ keys: listApiKeys(db) });
          }
          if (url.pathname.startsWith("/api/keys/") && req.method === "DELETE") {
            const id = parseInt(url.pathname.split("/").pop()!, 10);
            if (isNaN(id)) return Response.json({ error: "Invalid key ID" }, { status: 400 });
            const db = getDb();
            initAuth(db);
            const deleted = deleteApiKey(db, id);
            return Response.json({ deleted });
          }

          // Rate limiting for chat endpoints
          if (url.pathname.startsWith("/api/chat") || url.pathname.includes("/webhook/")) {
            const ip = getClientIp(req, server);
            const check = chatLimiter.check(ip);
            if (!check.allowed) {
              return Response.json(
                { error: "Too many requests. Please wait a moment and try again." },
                { status: 429, headers: { "Retry-After": String(Math.ceil((check.retryAfterMs ?? 1000) / 1000)) } }
              );
            }
          }

          // Rate limiting for upload endpoint
          if (url.pathname === "/api/upload") {
            const ip = getClientIp(req, server);
            const check = uploadLimiter.check(ip);
            if (!check.allowed) {
              return Response.json(
                { error: "Too many requests. Please wait a moment and try again." },
                { status: 429, headers: { "Retry-After": String(Math.ceil((check.retryAfterMs ?? 1000) / 1000)) } }
              );
            }
          }

          // Chat history — load last N messages for the web UI
          if (url.pathname === "/api/chat/history" && req.method === "GET") {
            try {
              const { loadSession } = await import("../agent/session");
              const limit = Math.min(parseInt(url.searchParams.get("limit") ?? "50", 10) || 50, 200);
              const messages = loadSession("owner", limit);
              // Map to a simpler format for the UI
              const history = messages.map((m) => ({
                role: m.role,
                content: Array.isArray(m.content)
                  ? m.content
                      .filter((b: any) => b.type === "text")
                      .map((b: any) => b.text ?? "")
                      .join("\n")
                  : String(m.content),
              })).filter((m) => m.content.trim());
              return Response.json({ messages: history });
            } catch {
              return Response.json({ messages: [] });
            }
          }

          // Chat API (non-streaming, backward compat)
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

          // Chat API (streaming via SSE)
          if (url.pathname === "/api/chat/stream" && req.method === "POST") {
            try {
              const body = (await req.json()) as { message?: string; threadId?: string };
              const text = body.message?.trim();
              if (!text) {
                return Response.json({ error: "No message" }, { status: 400 });
              }

              // Validate threadId format to prevent path traversal
              if (body.threadId && !/^[a-f0-9-]{36}$/.test(body.threadId)) {
                return Response.json({ error: "Invalid thread ID" }, { status: 400 });
              }

              // Use provided threadId as session, falling back to the shared session
              const effectiveSessionKey = body.threadId ?? sessionKey;

              const message: InboundMessage = {
                channel: "webchat",
                userId: "local",
                sessionKey: effectiveSessionKey,
                text,
              };

              const stream = new ReadableStream({
                start(controller) {
                  const encoder = new TextEncoder();
                  let closed = false;
                  const send = (event: string, data: any) => {
                    if (closed) return;
                    try {
                      controller.enqueue(
                        encoder.encode(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`)
                      );
                    } catch {
                      closed = true;
                    }
                  };
                  const close = () => {
                    if (closed) return;
                    closed = true;
                    try { controller.close(); } catch {}
                  };

                  if (!router.handleMessageStream) {
                    // Fallback to non-streaming
                    router.handleMessage(message, async (reply) => {
                      send("delta", { text: reply });
                      send("done", { reply });
                      close();
                    }).catch((err) => {
                      send("error", { error: err.message });
                      close();
                    });
                    return;
                  }

                  router.handleMessageStream(
                    message,
                    (delta) => send("delta", { text: delta }),
                    (name) => send("tool", { name, status: "start" }),
                    (name) => send("tool", { name, status: "end" }),
                  ).then((reply) => {
                    send("done", { reply });
                    close();
                  }).catch((err) => {
                    send("error", { error: err.message });
                    close();
                  });
                },
              });

              return new Response(stream, {
                headers: {
                  "Content-Type": "text/event-stream",
                  "Cache-Control": "no-cache",
                  "Connection": "keep-alive",
                },
              });
            } catch (err: any) {
              return Response.json(
                { error: err.message },
                { status: 500 }
              );
            }
          }

          // Upload endpoint
          if (url.pathname === "/api/upload" && req.method === "POST") {
            try {
              const formData = await req.formData();
              const file = formData.get("file") as File | null;
              if (!file) {
                return Response.json({ error: "No file provided" }, { status: 400 });
              }

              // Validate size (50MB max)
              const MAX_SIZE = 50 * 1024 * 1024;
              if (file.size > MAX_SIZE) {
                return Response.json({ error: "File too large (max 50MB)" }, { status: 400 });
              }

              // Validate MIME type — only allow supported document types
              const ALLOWED_MIME_TYPES = new Set([
                "text/plain", "text/markdown", "text/csv", "application/pdf",
                "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
                "application/json", "application/xml", "text/yaml",
              ]);
              const ALLOWED_EXTENSIONS = new Set([
                ".pdf", ".docx", ".txt", ".md", ".csv", ".json", ".html", ".xml", ".yaml", ".yml", ".ts", ".js", ".py", ".sh",
              ]);
              const ext = file.name.includes(".") ? "." + file.name.split(".").pop()!.toLowerCase() : "";
              if (!ALLOWED_EXTENSIONS.has(ext)) {
                return Response.json({ error: `Unsupported file type: ${ext}` }, { status: 400 });
              }
              if (!ALLOWED_MIME_TYPES.has(file.type) && file.type !== "application/octet-stream") {
                return Response.json({ error: "File type not allowed: " + file.type }, { status: 400 });
              }

              const { parseDocument, guessMimeType } = await import("../memory/document-parser");
              const { writeAndIndexMemory } = await import("../memory/engine");
              const { chunkText } = await import("../memory/chunker");
              const { mkdirSync, writeFileSync: fsWriteFileSync } = await import("fs");
              const pathMod = await import("path");

              // Save file
              mkdirSync(paths.uploads, { recursive: true });
              const safeName = file.name.replace(/[^a-zA-Z0-9._-]/g, "_").replace(/^\.+/, "_");
              const filePath = pathMod.join(paths.uploads, `${Date.now()}_${safeName}`);
              // Verify resolved path stays within uploads directory
              if (!pathMod.resolve(filePath).startsWith(pathMod.resolve(paths.uploads))) {
                return Response.json({ error: "Invalid filename" }, { status: 400 });
              }
              const buffer = Buffer.from(await file.arrayBuffer());
              fsWriteFileSync(filePath, buffer);

              // Parse document
              const mimeType = file.type || guessMimeType(file.name);
              const doc = await parseDocument(filePath, mimeType);

              // Chunk and index into memory
              const chunks = chunkText(doc.text, filePath);
              const db = getDb();
              for (const chunk of chunks) {
                await writeAndIndexMemory(db, `[File: ${file.name}] ${chunk.content}`);
              }

              // Track upload
              try {
                db.prepare(
                  "INSERT INTO uploads (filename, original_name, mime_type, size_bytes, chunk_count) VALUES (?, ?, ?, ?, ?)"
                ).run(filePath, file.name, mimeType, file.size, chunks.length);
              } catch (err: any) {
                logger.warn("Failed to record upload in database", { error: (err as Error).message });
              }

              return Response.json({
                uploaded: true,
                filename: file.name,
                size: file.size,
                chunks: chunks.length,
                wordCount: doc.metadata.wordCount,
              });
            } catch (err: any) {
              return Response.json({ error: err.message }, { status: 500 });
            }
          }

          // Voice chat endpoint
          if (url.pathname === "/api/chat/voice" && req.method === "POST") {
            try {
              const formData = await req.formData();
              const audio = formData.get("audio") as File | null;
              if (!audio) {
                return Response.json({ error: "No audio provided" }, { status: 400 });
              }

              const { getSttProvider } = await import("../voice/stt");
              const { getTtsProvider } = await import("../voice/tts");

              const stt = getSttProvider();
              if (!stt) {
                return Response.json({ error: "Voice not configured. Add voice settings to your config:\n\nzubo config set voice.stt.provider whisper\nzubo config set voice.stt.apiKey YOUR_OPENAI_API_KEY\n\nThen restart Zubo." }, { status: 400 });
              }

              // Transcribe
              const audioBuffer = Buffer.from(await audio.arrayBuffer());
              const transcript = await stt.transcribe(audioBuffer);

              if (!transcript.trim()) {
                return Response.json({ error: "Could not transcribe audio" }, { status: 400 });
              }

              // Route through agent
              const message: InboundMessage = {
                channel: "webchat",
                userId: "local",
                sessionKey,
                text: transcript,
              };

              let reply = "";
              await router.handleMessage(message, async (r) => {
                reply = r;
              });

              // Optionally synthesize TTS response
              const tts = getTtsProvider();
              const wantTts = formData.get("tts") === "true";
              let audioResponse: string | null = null;

              if (tts && wantTts && reply) {
                const ttsBuffer = await tts.synthesize(reply);
                audioResponse = ttsBuffer.toString("base64");
              }

              return Response.json({
                transcript,
                reply,
                audio: audioResponse,
                audioFormat: tts?.format ?? null,
              });
            } catch (err: any) {
              return Response.json({ error: err.message }, { status: 500 });
            }
          }

          // List uploads
          if (url.pathname === "/api/dashboard/uploads" && req.method === "GET") {
            try {
              const db = getDb();
              const uploads = db.query("SELECT * FROM uploads ORDER BY id DESC LIMIT 50").all();
              return Response.json({ uploads });
            } catch {
              return Response.json({ uploads: [] });
            }
          }

          // SSE events endpoint for desktop push notifications
          if (url.pathname === "/api/events" && req.method === "GET") {
            const stream = new ReadableStream({
              start(controller) {
                const encoder = new TextEncoder();
                const send = (event: string, data: any) => {
                  controller.enqueue(encoder.encode(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`));
                };
                // Send initial connection event
                send("connected", { timestamp: new Date().toISOString() });
                // Heartbeat every 30s
                const interval = setInterval(() => {
                  try { send("ping", { timestamp: new Date().toISOString() }); } catch { clearInterval(interval); }
                }, 30000);
                // Clean up on abort
                req.signal.addEventListener("abort", () => clearInterval(interval));
              },
            });
            return new Response(stream, {
              headers: { "Content-Type": "text/event-stream", "Cache-Control": "no-cache", "Connection": "keep-alive" },
            });
          }

          return new Response("Not Found", { status: 404 });
}
