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

// ─── Database ────────────────────────────────────────────────────────

function initDb(): Database {
  const dir = DB_PATH.substring(0, DB_PATH.lastIndexOf("/"));
  if (!existsSync(dir)) {
    Bun.spawnSync(["mkdir", "-p", dir]);
  }

  const db = new Database(DB_PATH, { create: true });
  db.run("PRAGMA journal_mode = WAL");
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
        // Split SQL respecting trigger BEGIN...END blocks (which contain semicolons)
        const statements: string[] = [];
        let current = "";
        let inTrigger = false;
        for (const line of sql.split("\n")) {
          const trimmed = line.trim().toUpperCase();
          if (trimmed.startsWith("CREATE TRIGGER")) inTrigger = true;
          current += line + "\n";
          if (inTrigger && trimmed === "END;") {
            statements.push(current.trim());
            current = "";
            inTrigger = false;
          } else if (!inTrigger && line.includes(";")) {
            statements.push(current.trim());
            current = "";
          }
        }
        if (current.trim()) statements.push(current.trim());

        db.transaction(() => {
          for (const stmt of statements) {
            const cleaned = stmt.replace(/;$/, "").trim();
            if (cleaned.length > 0) db.run(cleaned);
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
          Location: "/skills.html",
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
