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
    const msgs = (db.query("SELECT COUNT(*) as c FROM messages").get() as any)?.c ?? 0;
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
      return { ok: false, error: "Model is required" };
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

  // GET /api/dashboard/analytics/summary
  if (path === "/analytics/summary" && req.method === "GET") {
    try {
      const db = getDb();
      const totalTokens = db.query("SELECT COALESCE(SUM(input_tokens + output_tokens), 0) as total FROM usage").get() as any;
      const totalCost = db.query("SELECT COALESCE(SUM(cost_usd), 0) as total FROM usage WHERE cost_usd IS NOT NULL").get() as any;
      const avgResponse = db.query("SELECT COALESCE(AVG(response_time_ms), 0) as avg FROM usage WHERE response_time_ms IS NOT NULL").get() as any;
      const sessionCount = db.query("SELECT COUNT(DISTINCT session_id) as count FROM usage").get() as any;
      return Response.json({
        totalTokens: totalTokens?.total ?? 0,
        estimatedCostUsd: Math.round((totalCost?.total ?? 0) * 10000) / 10000,
        avgResponseTimeMs: Math.round(avgResponse?.avg ?? 0),
        sessionCount: sessionCount?.count ?? 0,
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

  // GET /api/dashboard/secrets/:name — reveal a single secret value
  if (path.startsWith("/secrets/") && req.method === "GET") {
    const secretName = decodeURIComponent(path.replace("/secrets/", ""));
    if (!secretName || !/^[a-z0-9_]+$/.test(secretName)) {
      return Response.json({ error: "Invalid secret name" }, { status: 400 });
    }
    try {
      // Check config provider keys first
      if (secretName.endsWith("_api_key")) {
        const provider = secretName.replace(/_api_key$/, "");
        try {
          const cfg = JSON.parse(readFileSync(paths.config, "utf-8"));
          if (cfg.providers?.[provider]?.apiKey) {
            return Response.json({ name: secretName, value: cfg.providers[provider].apiKey, source: "config" });
          }
        } catch (err: any) {
          logger.warn("Failed to read provider secret from config", { error: (err as Error).message });
        }
      }
      const db = getDb();
      const row = db.query("SELECT value FROM secrets WHERE name = ?").get(secretName) as { value: string } | null;
      if (!row) return Response.json({ error: "Not found" }, { status: 404 });
      return Response.json({ name: secretName, value: row.value });
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
  // Fallback to x-forwarded-for only if behind a trusted proxy
  return req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? "127.0.0.1";
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
          created_at TEXT NOT NULL DEFAULT (datetime('now')),
          updated_at TEXT NOT NULL DEFAULT (datetime('now'))
        )`);
      } catch (err: any) {
        logger.warn("Failed to create threads table", { error: (err as Error).message });
      }

      server = Bun.serve({
        port,
        async fetch(req) {
          const url = new URL(req.url);

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
            const result = handleDashboardApi(url, req);
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
          if (url.pathname.startsWith("/api/chat")) {
            const ip = getClientIp(req, server);
            const check = chatLimiter.check(ip);
            if (!check.allowed) {
              return Response.json(
                { error: "Rate limit exceeded" },
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
                { error: "Rate limit exceeded" },
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
                  const send = (event: string, data: any) => {
                    controller.enqueue(
                      encoder.encode(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`)
                    );
                  };

                  if (!router.handleMessageStream) {
                    // Fallback to non-streaming
                    router.handleMessage(message, async (reply) => {
                      send("delta", { text: reply });
                      send("done", { reply });
                      controller.close();
                    }).catch((err) => {
                      send("error", { error: err.message });
                      controller.close();
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
                    controller.close();
                  }).catch((err) => {
                    send("error", { error: err.message });
                    controller.close();
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
                return Response.json({ error: "STT not configured" }, { status: 400 });
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
