#!/usr/bin/env bun
/**
 * Standalone Zubo Skill Registry Server
 *
 * Serves the marketing site, skills page, and registry API.
 * Run: GITHUB_CLIENT_ID=xxx GITHUB_CLIENT_SECRET=yyy bun run src/registry/server.ts
 */

import { Database } from "bun:sqlite";
import { readFileSync, readdirSync, existsSync, statSync } from "fs";
import { join, extname, resolve } from "path";
import { homedir } from "os";
import * as registry from "./skill-registry";

// ─── Config ──────────────────────────────────────────────────────────

const PORT = parseInt(process.env.REGISTRY_PORT ?? "3001", 10);
const GITHUB_CLIENT_ID = process.env.GITHUB_CLIENT_ID ?? "";
const GITHUB_CLIENT_SECRET = process.env.GITHUB_CLIENT_SECRET ?? "";
const ADMIN_KEY = process.env.REGISTRY_ADMIN_KEY ?? "";
const DB_PATH = process.env.REGISTRY_DB_PATH ?? join(homedir(), ".zubo", "registry.db");
const SITE_DIR = resolve(join(import.meta.dir, "../../site"));
const SENDGRID_API_KEY = process.env.SENDGRID_API_KEY ?? "";
const ADMIN_EMAIL = process.env.ADMIN_EMAIL ?? "";
const FROM_EMAIL = process.env.FROM_EMAIL ?? "noreply@zubo.bot";

// ─── Database ────────────────────────────────────────────────────────

function initDb(): Database {
  const dir = DB_PATH.substring(0, DB_PATH.lastIndexOf("/"));
  if (!existsSync(dir)) {
    Bun.spawnSync(["mkdir", "-p", dir]);
  }

  let db: Database;
  try {
    db = new Database(DB_PATH, { create: true });
    db.run("PRAGMA journal_mode = WAL");
  } catch (err: any) {
    // If DB is corrupted, delete and recreate
    console.warn("[registry] Database corrupted, recreating:", err.message);
    const { unlinkSync } = require("fs");
    for (const suffix of ["", "-wal", "-shm"]) {
      try { unlinkSync(DB_PATH + suffix); } catch {}
    }
    db = new Database(DB_PATH, { create: true });
    db.run("PRAGMA journal_mode = WAL");
  }
  db.run("PRAGMA foreign_keys = ON");
  db.run("PRAGMA busy_timeout = 5000");

  // Run migration
  const migrationPath = resolve(join(import.meta.dir, "../../migrations/023_skill_registry.sql"));
  if (existsSync(migrationPath)) {
    // Check if already migrated
    try {
      db.run("CREATE TABLE IF NOT EXISTS _migrations (id INTEGER PRIMARY KEY AUTOINCREMENT, name TEXT UNIQUE NOT NULL, applied_at TEXT DEFAULT (datetime('now')))");
      const applied = db.query<{ name: string }, []>("SELECT name FROM _migrations WHERE name = '023_skill_registry.sql'").get();
      if (!applied) {
        const sql = readFileSync(migrationPath, "utf-8");
        // Parse SQL into individual statements, respecting trigger BEGIN...END blocks
        const statements: string[] = [];
        let buffer = "";
        let depth = 0;
        for (const line of sql.split("\n")) {
          const upper = line.trim().toUpperCase();
          // Skip empty lines and comments
          if (!upper || upper.startsWith("--")) continue;
          buffer += line + "\n";
          // Track BEGIN/END depth for triggers
          if (upper.includes("BEGIN")) depth++;
          if (upper.startsWith("END;")) depth = Math.max(depth - 1, 0);
          // Statement complete when we see a semicolon at depth 0
          if (depth === 0 && line.trim().endsWith(";")) {
            statements.push(buffer.trim());
            buffer = "";
          }
        }
        db.transaction(() => {
          for (const stmt of statements) {
            db.run(stmt);
          }
          db.prepare("INSERT INTO _migrations (name) VALUES (?)").run("023_skill_registry.sql");
        })();
        console.log("[registry] Migration 023_skill_registry.sql applied");
      }
    } catch (err: any) {
      console.error("[registry] Migration error:", err.message);
    }
  }

  return db;
}

const db = initDb();

// ─── Seed Built-in Skills ───────────────────────────────────────────

function seedBuiltinSkills(db: Database): void {
  // Check if already seeded
  const count = db.query<{ c: number }, []>("SELECT COUNT(*) as c FROM registry_skills").get();
  if (count && count.c > 0) return;

  // Create the official Zubo profile
  db.prepare(
    `INSERT OR IGNORE INTO registry_profiles (github_id, username, display_name, bio, website, github_url, avatar_url)
     VALUES (?, ?, ?, ?, ?, ?, ?)`
  ).run(
    1, "zubo", "Zubo", "Official built-in skills", "https://zubo.bot",
    "https://github.com/apwn/zubo", "https://github.com/apwn.png"
  );

  const profile = db.query<{ id: number }, [string]>(
    "SELECT id FROM registry_profiles WHERE username = ?"
  ).get("zubo");
  if (!profile) return;

  const SKILLS_DIR = resolve(join(import.meta.dir, "../tools/builtin-skills"));

  const skills: Array<{
    dir: string;
    name: string;
    description: string;
    tags: string[];
    version: string;
  }> = [
    {
      dir: "web-search",
      name: "web-search",
      description: "Search the web using DuckDuckGo and return relevant results with titles, URLs, and snippets.",
      tags: ["search", "web", "utility"],
      version: "1.0.0",
    },
    {
      dir: "url-fetch",
      name: "url-fetch",
      description: "Fetch the content of any URL and return the text body with automatic HTML tag stripping.",
      tags: ["web", "utility", "fetch"],
      version: "1.0.0",
    },
    {
      dir: "http-request",
      name: "http-request",
      description: "Make HTTP requests to any URL with full control over method, headers, and body. Supports GET, POST, PUT, DELETE, PATCH with SSRF protection.",
      tags: ["web", "api", "utility"],
      version: "1.0.0",
    },
    {
      dir: "code-interpreter",
      name: "code-interpreter",
      description: "Execute Python, JavaScript, or TypeScript code in a sandboxed subprocess and return the output. Great for calculations, data processing, and text manipulation.",
      tags: ["code", "sandbox", "python", "javascript"],
      version: "1.0.0",
    },
    {
      dir: "shell",
      name: "shell",
      description: "Execute shell commands and return their output. Includes security guards against destructive operations and sensitive environment variable leakage.",
      tags: ["shell", "system", "utility"],
      version: "1.0.0",
    },
    {
      dir: "file-read",
      name: "file-read",
      description: "Read the contents of files from the local filesystem with path validation and sensitive file blocking.",
      tags: ["filesystem", "utility"],
      version: "1.0.0",
    },
    {
      dir: "file-write",
      name: "file-write",
      description: "Write or append content to files on the local filesystem with path validation and sensitive file blocking.",
      tags: ["filesystem", "utility"],
      version: "1.0.0",
    },
    {
      dir: "image-generate",
      name: "image-generate",
      description: "Generate images using AI models including DALL-E 3, Flux, and Together AI. Returns file paths of generated images.",
      tags: ["ai", "image", "creative"],
      version: "1.0.0",
    },
    {
      dir: "kg-query",
      name: "kg-query",
      description: "Query the knowledge graph to find entities, their relationships, and structured information. Recall people, projects, concepts, and how they connect.",
      tags: ["memory", "knowledge-graph", "search"],
      version: "1.0.0",
    },
    {
      dir: "kg-update",
      name: "kg-update",
      description: "Update the knowledge graph by adding or removing entities and relationships. Build structured memory about people, projects, and concepts.",
      tags: ["memory", "knowledge-graph"],
      version: "1.0.0",
    },
    {
      dir: "webhook-manage",
      name: "webhook-manage",
      description: "Manage webhook endpoints for external services like GitHub, Stripe, and CI/CD. Create, list, delete, and toggle webhooks with optional HMAC verification.",
      tags: ["webhooks", "integrations", "api"],
      version: "1.0.0",
    },
    {
      dir: "oauth-manage",
      name: "oauth-manage",
      description: "Manage OAuth connections for third-party integrations including Google, GitHub, Notion, Linear, and Slack.",
      tags: ["oauth", "integrations", "auth"],
      version: "1.0.0",
    },
  ];

  let seeded = 0;
  for (const skill of skills) {
    const handlerPath = join(SKILLS_DIR, skill.dir, "handler.ts");
    if (!existsSync(handlerPath)) continue;

    const handlerCode = readFileSync(handlerPath, "utf-8");

    try {
      db.prepare(
        `INSERT INTO registry_skills
          (name, description, author_id, version, tags, secrets, handler_code, status, review_notes, risk_level)
         VALUES (?, ?, ?, ?, ?, ?, ?, 'approved', '[]', 'low')`
      ).run(
        skill.name,
        skill.description,
        profile.id,
        skill.version,
        JSON.stringify(skill.tags),
        "[]",
        handlerCode
      );
      seeded++;
    } catch (err: any) {
      console.error(`[registry] Failed to seed skill "${skill.name}":`, err.message);
    }
  }

  if (seeded > 0) {
    console.log(`[registry] Seeded ${seeded} built-in skills`);
  }
}

seedBuiltinSkills(db);

// ─── Rate Limiter ────────────────────────────────────────────────────

const rateLimits = new Map<string, { count: number; resetAt: number }>();

function checkRateLimit(ip: string, maxPerMin: number): boolean {
  const now = Date.now();
  const entry = rateLimits.get(ip);
  if (!entry || now > entry.resetAt) {
    rateLimits.set(ip, { count: 1, resetAt: now + 60_000 });
    return true;
  }
  entry.count++;
  return entry.count <= maxPerMin;
}

// Clean up rate limit entries periodically
setInterval(() => {
  const now = Date.now();
  for (const [ip, entry] of rateLimits) {
    if (now > entry.resetAt) rateLimits.delete(ip);
  }
}, 60_000);

// ─── Email (SendGrid) ────────────────────────────────────────────────

async function sendEmail(to: string, subject: string, html: string): Promise<boolean> {
  if (!SENDGRID_API_KEY) return false;
  try {
    const res = await fetch("https://api.sendgrid.com/v3/mail/send", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${SENDGRID_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        personalizations: [{ to: [{ email: to }] }],
        from: { email: FROM_EMAIL, name: "Zubo Skills" },
        subject,
        content: [{ type: "text/html", value: html }],
      }),
    });
    return res.status === 202;
  } catch {
    return false;
  }
}

async function notifyAdminReport(skillName: string, reason: string, email: string, details?: string): Promise<void> {
  if (!ADMIN_EMAIL) return;
  await sendEmail(
    ADMIN_EMAIL,
    `[Zubo] Skill reported: ${skillName}`,
    `<h3>Skill Report</h3>
     <p><strong>Skill:</strong> ${skillName}</p>
     <p><strong>Reason:</strong> ${reason}</p>
     <p><strong>Reporter:</strong> ${email}</p>
     ${details ? `<p><strong>Details:</strong> ${details}</p>` : ""}
     <p><a href="https://zubo.bot/skills">View Registry</a></p>`
  );
}

async function notifyAdminNewSkill(skillName: string, author: string, status: string): Promise<void> {
  if (!ADMIN_EMAIL) return;
  await sendEmail(
    ADMIN_EMAIL,
    `[Zubo] New skill submitted: ${skillName}`,
    `<h3>New Skill Submission</h3>
     <p><strong>Skill:</strong> ${skillName}</p>
     <p><strong>Author:</strong> ${author}</p>
     <p><strong>Auto-review status:</strong> ${status}</p>
     <p><a href="https://zubo.bot/skills">View Registry</a></p>`
  );
}

// ─── Helpers ─────────────────────────────────────────────────────────

function json(data: any, status = 200): Response {
  return new Response(JSON.stringify(data), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

function error(message: string, status = 400): Response {
  return json({ error: message }, status);
}

function getSessionProfile(req: Request): registry.Profile | null {
  const cookie = req.headers.get("cookie") ?? "";
  const match = cookie.match(/zubo_session=([^;]+)/);
  if (!match) return null;
  return registry.getProfileByToken(db, match[1]);
}

function isAdmin(req: Request): boolean {
  if (!ADMIN_KEY) return false;
  const auth = req.headers.get("authorization") ?? "";
  return auth === `Bearer ${ADMIN_KEY}`;
}

function getClientIp(req: Request): string {
  return req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? "unknown";
}

const MIME_TYPES: Record<string, string> = {
  ".html": "text/html; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".js": "application/javascript; charset=utf-8",
  ".json": "application/json",
  ".svg": "image/svg+xml",
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".ico": "image/x-icon",
  ".xml": "application/xml",
  ".txt": "text/plain; charset=utf-8",
  ".sh": "text/plain; charset=utf-8",
  ".webp": "image/webp",
};

function serveStatic(filePath: string): Response | null {
  const fullPath = resolve(join(SITE_DIR, filePath));
  // Security: ensure path stays within site dir
  if (!fullPath.startsWith(SITE_DIR)) return null;

  if (!existsSync(fullPath)) return null;
  const stat = statSync(fullPath);
  if (stat.isDirectory()) {
    // Try index.html
    const indexPath = join(fullPath, "index.html");
    if (existsSync(indexPath)) {
      return new Response(readFileSync(indexPath), {
        headers: { "Content-Type": "text/html; charset=utf-8" },
      });
    }
    return null;
  }

  const ext = extname(fullPath).toLowerCase();
  const contentType = MIME_TYPES[ext] ?? "application/octet-stream";

  return new Response(readFileSync(fullPath), {
    headers: {
      "Content-Type": contentType,
      "Cache-Control": ext === ".html" ? "no-cache" : "public, max-age=3600",
    },
  });
}

// ─── Route Handler ───────────────────────────────────────────────────

async function handleRequest(req: Request): Promise<Response> {
  const url = new URL(req.url);
  const path = url.pathname;
  const method = req.method;
  const ip = getClientIp(req);

  // ─── GitHub OAuth ────────────────────────────────────────────────

  if (path === "/api/registry/auth/github" && method === "GET") {
    if (!GITHUB_CLIENT_ID) return error("GitHub OAuth not configured", 500);
    const state = crypto.randomUUID();
    const redirectUri = `${url.origin}/api/registry/auth/github/callback`;
    const ghUrl = `https://github.com/login/oauth/authorize?client_id=${GITHUB_CLIENT_ID}&redirect_uri=${encodeURIComponent(redirectUri)}&scope=read:user%20user:email&state=${state}`;
    return new Response(null, {
      status: 302,
      headers: {
        Location: ghUrl,
        "Set-Cookie": `zubo_oauth_state=${state}; Path=/; HttpOnly; SameSite=Lax; Max-Age=600`,
      },
    });
  }

  if (path === "/api/registry/auth/github/callback" && method === "GET") {
    const code = url.searchParams.get("code");
    if (!code) return error("Missing code parameter");

    try {
      // Exchange code for token
      const tokenRes = await fetch("https://github.com/login/oauth/access_token", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Accept: "application/json",
        },
        body: JSON.stringify({
          client_id: GITHUB_CLIENT_ID,
          client_secret: GITHUB_CLIENT_SECRET,
          code,
        }),
      });

      const tokenData = (await tokenRes.json()) as { access_token?: string; error?: string };
      if (!tokenData.access_token) {
        return error(`GitHub OAuth failed: ${tokenData.error ?? "unknown error"}`);
      }

      // Fetch GitHub user info
      const userRes = await fetch("https://api.github.com/user", {
        headers: {
          Authorization: `Bearer ${tokenData.access_token}`,
          Accept: "application/json",
          "User-Agent": "Zubo-Registry",
        },
      });

      if (!userRes.ok) return error("Failed to fetch GitHub user info");

      const ghUser = (await userRes.json()) as registry.GitHubUser;
      const profile = registry.createOrUpdateProfile(db, ghUser);
      const sessionToken = registry.createSessionToken(db, profile.id);

      return new Response(null, {
        status: 302,
        headers: {
          Location: "/skills",
          "Set-Cookie": `zubo_session=${sessionToken}; Path=/; HttpOnly; SameSite=Lax; Max-Age=${30 * 86400}`,
        },
      });
    } catch (err: any) {
      return error(`OAuth callback error: ${err.message}`, 500);
    }
  }

  if (path === "/api/registry/auth/me" && method === "GET") {
    const profile = getSessionProfile(req);
    if (!profile) return json({ profile: null });
    const stars = registry.getUserStars(db, profile.id);
    return json({
      profile: {
        id: profile.id,
        username: profile.username,
        display_name: profile.display_name,
        avatar_url: profile.avatar_url,
        github_url: profile.github_url,
      },
      stars,
    });
  }

  if (path === "/api/registry/auth/logout" && method === "POST") {
    const profile = getSessionProfile(req);
    if (profile) registry.clearSessionToken(db, profile.id);
    return new Response(JSON.stringify({ ok: true }), {
      status: 200,
      headers: {
        "Content-Type": "application/json",
        "Set-Cookie": "zubo_session=; Path=/; HttpOnly; Max-Age=0",
      },
    });
  }

  // ─── Public API (rate-limited) ───────────────────────────────────

  if (path.startsWith("/api/registry/")) {
    // Rate limit: 30/min for reads, 10/min for writes
    const isWrite = method === "POST" || method === "PUT" || method === "DELETE";
    const limit = isWrite ? 10 : 30;
    if (!checkRateLimit(ip, limit)) {
      return error("Too many requests. Please try again later.", 429);
    }
  }

  // List skills
  if (path === "/api/registry/skills" && method === "GET") {
    const tag = url.searchParams.get("tag") ?? undefined;
    const sort = (url.searchParams.get("sort") ?? "newest") as any;
    const limit = parseInt(url.searchParams.get("limit") ?? "50", 10);
    const offset = parseInt(url.searchParams.get("offset") ?? "0", 10);
    const status = url.searchParams.get("status") ?? "approved";
    const result = registry.listSkills(db, { tag, sort, limit, offset, status });
    return json(result);
  }

  // Get skill by ID
  const skillIdMatch = path.match(/^\/api\/registry\/skills\/(\d+)$/);
  if (skillIdMatch && method === "GET") {
    const skill = registry.getSkillById(db, parseInt(skillIdMatch[1], 10));
    if (!skill) return error("Skill not found", 404);

    // Get author info
    const author = registry.getProfileById(db, skill.author_id);

    // Record install (via query param)
    if (url.searchParams.get("install") === "true") {
      const fingerprint = url.searchParams.get("fp") ?? ip;
      registry.recordInstall(db, skill.id, fingerprint);
    }

    return json({
      skill,
      author: author ? {
        username: author.username,
        display_name: author.display_name,
        avatar_url: author.avatar_url,
        github_url: author.github_url,
      } : null,
    });
  }

  // Submit skill (authenticated)
  if (path === "/api/registry/skills" && method === "POST") {
    const profile = getSessionProfile(req);
    if (!profile) return error("Authentication required", 401);

    try {
      const body = (await req.json()) as registry.SubmitSkillInput;
      const result = registry.submitSkill(db, body, profile.id);
      notifyAdminNewSkill(result.skill.name, profile.username, result.review.status);
      return json(result, 201);
    } catch (err: any) {
      return error(err.message);
    }
  }

  // Star skill (authenticated)
  const starMatch = path.match(/^\/api\/registry\/skills\/(\d+)\/star$/);
  if (starMatch && method === "POST") {
    const profile = getSessionProfile(req);
    if (!profile) return error("Authentication required", 401);
    const skillId = parseInt(starMatch[1], 10);
    const skill = registry.getSkillById(db, skillId);
    if (!skill) return error("Skill not found", 404);
    const starred = registry.toggleStar(db, skillId, profile.id);
    const updated = registry.getSkillById(db, skillId)!;
    return json({ starred, stars_count: updated.stars_count });
  }

  // Report skill (anonymous)
  const reportMatch = path.match(/^\/api\/registry\/skills\/(\d+)\/report$/);
  if (reportMatch && method === "POST") {
    const skillId = parseInt(reportMatch[1], 10);
    const skill = registry.getSkillById(db, skillId);
    if (!skill) return error("Skill not found", 404);

    try {
      const body = (await req.json()) as { email: string; reason: string; details?: string };
      registry.reportSkill(db, skillId, body.email, body.reason, body.details);
      notifyAdminReport(skill.name, body.reason, body.email, body.details);
      return json({ ok: true });
    } catch (err: any) {
      return error(err.message);
    }
  }

  // Search
  if (path === "/api/registry/search" && method === "GET") {
    const q = url.searchParams.get("q") ?? "";
    const limit = parseInt(url.searchParams.get("limit") ?? "20", 10);
    const skills = registry.searchSkills(db, q, limit);
    return json({ skills });
  }

  // Trending
  if (path === "/api/registry/trending" && method === "GET") {
    const limit = parseInt(url.searchParams.get("limit") ?? "20", 10);
    return json({ skills: registry.getTrendingSkills(db, limit) });
  }

  // Popular
  if (path === "/api/registry/popular" && method === "GET") {
    const limit = parseInt(url.searchParams.get("limit") ?? "20", 10);
    return json({ skills: registry.getPopularSkills(db, limit) });
  }

  // Newest
  if (path === "/api/registry/newest" && method === "GET") {
    const limit = parseInt(url.searchParams.get("limit") ?? "20", 10);
    return json({ skills: registry.getNewestSkills(db, limit) });
  }

  // Tags
  if (path === "/api/registry/tags" && method === "GET") {
    return json({ tags: registry.getTagCounts(db) });
  }

  // Profile
  const profileMatch = path.match(/^\/api\/registry\/profiles\/([a-zA-Z0-9_-]+)$/);
  if (profileMatch && method === "GET") {
    const profile = registry.getProfile(db, profileMatch[1]);
    if (!profile) return error("Profile not found", 404);
    const stats = registry.getAuthorStats(db, profile.id);
    const skills = registry.getProfileSkills(db, profile.id);
    return json({
      profile: {
        id: profile.id,
        username: profile.username,
        display_name: profile.display_name,
        bio: profile.bio,
        website: profile.website,
        github_url: profile.github_url,
        avatar_url: profile.avatar_url,
        created_at: profile.created_at,
      },
      stats,
      skills,
    });
  }

  // ─── Admin API ───────────────────────────────────────────────────

  const adminSkillStatusMatch = path.match(/^\/api\/registry\/admin\/skills\/(\d+)\/status$/);
  if (adminSkillStatusMatch && method === "PUT") {
    if (!isAdmin(req)) return error("Unauthorized", 403);
    const body = (await req.json()) as { status: "approved" | "flagged" | "rejected" };
    registry.updateSkillStatus(db, parseInt(adminSkillStatusMatch[1], 10), body.status);
    return json({ ok: true });
  }

  const adminSkillDeleteMatch = path.match(/^\/api\/registry\/admin\/skills\/(\d+)$/);
  if (adminSkillDeleteMatch && method === "DELETE") {
    if (!isAdmin(req)) return error("Unauthorized", 403);
    registry.deleteSkill(db, parseInt(adminSkillDeleteMatch[1], 10));
    return json({ ok: true });
  }

  if (path === "/api/registry/admin/reports" && method === "GET") {
    if (!isAdmin(req)) return error("Unauthorized", 403);
    return json({ reports: registry.getOpenReports(db) });
  }

  const adminReportMatch = path.match(/^\/api\/registry\/admin\/reports\/(\d+)$/);
  if (adminReportMatch && method === "PUT") {
    if (!isAdmin(req)) return error("Unauthorized", 403);
    const body = (await req.json()) as { status: "resolved" | "dismissed" };
    registry.updateReportStatus(db, parseInt(adminReportMatch[1], 10), body.status);
    return json({ ok: true });
  }

  // ─── Static Files ────────────────────────────────────────────────

  // Serve static site files
  if (!path.startsWith("/api/")) {
    // Redirect .html URLs to clean URLs (SEO canonical)
    if (path.endsWith(".html")) {
      const clean = path === "/index.html" ? "/" : path.slice(0, -5);
      return new Response(null, {
        status: 301,
        headers: { Location: clean + url.search },
      });
    }

    // Profile URLs: /u/:username → serve skills page (JS handles routing)
    if (path.startsWith("/u/") && path.split("/").length === 3) {
      const profilePage = serveStatic("/skills.html");
      if (profilePage) return profilePage;
    }

    let filePath = path === "/" ? "/index.html" : path;
    const response = serveStatic(filePath);
    if (response) return response;

    // Try with .html extension
    const htmlResponse = serveStatic(filePath + ".html");
    if (htmlResponse) return htmlResponse;

    // 404 fallback
    const notFoundPage = serveStatic("/404.html");
    if (notFoundPage) {
      return new Response(notFoundPage.body, {
        status: 404,
        headers: notFoundPage.headers,
      });
    }
    return new Response("Not Found", { status: 404 });
  }

  return error("Not found", 404);
}

// ─── Server Start ────────────────────────────────────────────────────

const server = Bun.serve({
  port: PORT,
  fetch: handleRequest,
});

console.log(`[registry] Zubo Skill Registry running at http://localhost:${server.port}`);
console.log(`[registry] Database: ${DB_PATH}`);
console.log(`[registry] Site directory: ${SITE_DIR}`);
console.log(`[registry] GitHub OAuth: ${GITHUB_CLIENT_ID ? "configured" : "not configured"}`);
console.log(`[registry] Admin key: ${ADMIN_KEY ? "configured" : "not configured"}`);
console.log(`[registry] SendGrid: ${SENDGRID_API_KEY ? "configured" : "not configured"}${ADMIN_EMAIL ? ` (→ ${ADMIN_EMAIL})` : ""}`);
