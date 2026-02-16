import { readFileSync, writeFileSync } from "fs";
import { logger } from "../util/logger";
import { paths } from "../config/paths";
import {
  connectMcpServer,
  disconnectMcpServer,
  getMcpStatus,
} from "./mcp-client";
import type { McpServerConfig } from "./mcp-client";

// ---------------------------------------------------------------------------
// Registry API base URL
// ---------------------------------------------------------------------------
const BASE_URL = "https://registry.modelcontextprotocol.io/v0.1";

// ---------------------------------------------------------------------------
// Simple in-memory cache (5-minute TTL)
// ---------------------------------------------------------------------------
const cache = new Map<string, { data: any; ts: number }>();
const CACHE_TTL = 5 * 60 * 1000;

function getCached(key: string): any | null {
  const entry = cache.get(key);
  if (entry && Date.now() - entry.ts < CACHE_TTL) return entry.data;
  return null;
}

function setCache(key: string, data: any): void {
  cache.set(key, { data, ts: Date.now() });
}

// ---------------------------------------------------------------------------
// 1. searchRegistry
// ---------------------------------------------------------------------------

/**
 * Search the MCP Registry for servers matching a query string.
 * Results are cached for 5 minutes.
 */
export async function searchRegistry(
  query: string,
  limit: number = 20,
): Promise<any[]> {
  const cacheKey = `search:${query}:${limit}`;
  const cached = getCached(cacheKey);
  if (cached) return cached;

  try {
    const url = `${BASE_URL}/servers?search=${encodeURIComponent(query)}&limit=${limit}`;
    const res = await fetch(url);
    if (!res.ok) {
      logger.warn(`MCP registry search failed: ${res.status} ${res.statusText}`);
      return [];
    }
    const data = await res.json();
    const raw: any[] = Array.isArray(data) ? data : data.servers ?? [];
    // Registry wraps each entry in { server: {...}, _meta: {...} } — unwrap
    const servers: any[] = raw.map((e: any) => e.server ?? e);
    setCache(cacheKey, servers);
    return servers;
  } catch (err: any) {
    logger.warn("MCP registry search error", { error: err.message });
    return [];
  }
}

// ---------------------------------------------------------------------------
// 2. getServerDetail
// ---------------------------------------------------------------------------

/**
 * Fetch detailed information about a specific MCP server from the registry.
 * Returns null on error.
 */
export async function getServerDetail(name: string): Promise<any | null> {
  const cacheKey = `detail:${name}`;
  const cached = getCached(cacheKey);
  if (cached) return cached;

  try {
    const url = `${BASE_URL}/servers/${encodeURIComponent(name)}`;
    const res = await fetch(url);
    if (!res.ok) {
      logger.warn(`MCP registry detail fetch failed for "${name}": ${res.status} ${res.statusText}`);
      return null;
    }
    const data = await res.json();
    // Registry may wrap in { server: {...}, _meta: {...} } — unwrap
    const server = data.server ?? data;
    setCache(cacheKey, server);
    return server;
  } catch (err: any) {
    logger.warn(`MCP registry detail error for "${name}"`, { error: err.message });
    return null;
  }
}

// ---------------------------------------------------------------------------
// 3. listRegistry
// ---------------------------------------------------------------------------

/**
 * List servers from the MCP Registry with optional cursor-based pagination.
 * Results are cached for 5 minutes.
 */
export async function listRegistry(
  cursor?: string,
  limit: number = 20,
): Promise<{ servers: any[]; nextCursor?: string }> {
  const cacheKey = `list:${cursor ?? ""}:${limit}`;
  const cached = getCached(cacheKey);
  if (cached) return cached;

  try {
    const url = `${BASE_URL}/servers?limit=${limit}${cursor ? "&cursor=" + cursor : ""}`;
    const res = await fetch(url);
    if (!res.ok) {
      logger.warn(`MCP registry list failed: ${res.status} ${res.statusText}`);
      return { servers: [] };
    }
    const data = await res.json();
    const raw: any[] = Array.isArray(data) ? data : data.servers ?? [];
    // Registry wraps each entry in { server: {...}, _meta: {...} } — unwrap
    const result = {
      servers: raw.map((e: any) => e.server ?? e),
      nextCursor: (data.metadata?.nextCursor ?? data.nextCursor) as string | undefined,
    };
    setCache(cacheKey, result);
    return result;
  } catch (err: any) {
    logger.warn("MCP registry list error", { error: err.message });
    return { servers: [] };
  }
}

// ---------------------------------------------------------------------------
// 4. installFromRegistry
// ---------------------------------------------------------------------------

/**
 * Install an MCP server from the registry into Zubo's config and hot-connect it.
 *
 * - Fetches server detail from the registry
 * - Builds an McpServerConfig and persists it to config.json
 * - Calls connectMcpServer to start the server immediately
 * - Returns the server name and number of tools registered
 */
export async function installFromRegistry(
  serverName: string,
): Promise<{ name: string; tools: number }> {
  // Fetch detail from registry
  const detail = await getServerDetail(serverName);
  if (!detail) {
    throw new Error(`Server "${serverName}" not found in MCP registry`);
  }

  // Build server config
  const serverConfig: McpServerConfig = {
    name: serverName,
    command: detail.command || "npx",
    args: detail.args || [serverName],
    env: detail.env || {},
    enabled: true,
  };

  // Read current config.json, add/replace server entry
  const raw = readFileSync(paths.config, "utf-8");
  const config = JSON.parse(raw);

  if (!config.mcp) {
    config.mcp = { servers: [] };
  }
  if (!Array.isArray(config.mcp.servers)) {
    config.mcp.servers = [];
  }

  // Remove existing entry with the same name
  config.mcp.servers = config.mcp.servers.filter(
    (s: any) => s.name !== serverName,
  );

  // Add the new entry
  config.mcp.servers.push({
    name: serverConfig.name,
    command: serverConfig.command,
    args: serverConfig.args,
    env: serverConfig.env,
    enabled: serverConfig.enabled,
  });

  // Write config.json back
  writeFileSync(paths.config, JSON.stringify(config, null, 2) + "\n", "utf-8");

  // Hot-connect the server
  let toolCount = 0;
  try {
    await connectMcpServer(serverConfig);
    // Retrieve tool count from the live status
    const status = getMcpStatus();
    const entry = status.find((s) => s.name === serverName);
    toolCount = entry?.tools ?? 0;
  } catch (err: any) {
    logger.warn(`MCP server "${serverName}" saved but failed to connect`, {
      error: err.message,
    });
    // Config is saved — return tools: 0
  }

  return { name: serverName, tools: toolCount };
}

// ---------------------------------------------------------------------------
// 5. uninstallMcpServer
// ---------------------------------------------------------------------------

/**
 * Disconnect and remove an MCP server from Zubo's config.
 */
export async function uninstallMcpServer(serverName: string): Promise<void> {
  // Disconnect the live server (no-op if not connected)
  await disconnectMcpServer(serverName);

  // Read current config.json and remove the server entry
  const raw = readFileSync(paths.config, "utf-8");
  const config = JSON.parse(raw);

  if (config.mcp && Array.isArray(config.mcp.servers)) {
    config.mcp.servers = config.mcp.servers.filter(
      (s: any) => s.name !== serverName,
    );
  }

  // Write config.json back
  writeFileSync(paths.config, JSON.stringify(config, null, 2) + "\n", "utf-8");
}
