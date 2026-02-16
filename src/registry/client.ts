import { logger } from "../util/logger";

const REGISTRY_API = process.env.ZUBO_REGISTRY_URL || "https://skills.zubo.bot/api/registry";
const CACHE_TTL_MS = 5 * 60_000;

export interface RegistryEntry {
  id: number;
  name: string;
  description: string;
  author_username: string;
  version: string;
  tags: string[];
  secrets: string[];
  handler_code: string;
  skill_md: string | null;
  repo_url: string | null;
  status: string;
  stars_count: number;
  install_count: number;
}

let cachedRegistry: RegistryEntry[] | null = null;
let cacheTime = 0;

function parseTags(tags: string | string[]): string[] {
  if (Array.isArray(tags)) return tags;
  try { return JSON.parse(tags); } catch { return []; }
}

function parseSecrets(secrets: string | string[]): string[] {
  if (Array.isArray(secrets)) return secrets;
  try { return JSON.parse(secrets); } catch { return []; }
}

export async function fetchRegistry(): Promise<RegistryEntry[]> {
  const now = Date.now();
  if (cachedRegistry && now - cacheTime < CACHE_TTL_MS) {
    return cachedRegistry;
  }

  try {
    const res = await fetch(`${REGISTRY_API}/skills?limit=100&status=approved`);
    if (!res.ok) {
      throw new Error(`Registry fetch failed: ${res.status}`);
    }
    const data = (await res.json()) as { skills: any[] };
    cachedRegistry = (data.skills ?? []).map((s: any) => ({
      ...s,
      tags: parseTags(s.tags),
      secrets: parseSecrets(s.secrets),
    }));
    cacheTime = now;
    return cachedRegistry;
  } catch (err: any) {
    logger.warn("Failed to fetch skill registry", { error: err.message });
    return cachedRegistry ?? [];
  }
}

export async function searchRegistry(query: string): Promise<RegistryEntry[]> {
  try {
    const res = await fetch(`${REGISTRY_API}/search?q=${encodeURIComponent(query)}`);
    if (!res.ok) throw new Error(`Search failed: ${res.status}`);
    const data = (await res.json()) as { skills: any[] };
    return (data.skills ?? []).map((s: any) => ({
      ...s,
      tags: parseTags(s.tags),
      secrets: parseSecrets(s.secrets),
    }));
  } catch (err: any) {
    logger.warn("Failed to search registry", { error: err.message });
    // Fall back to local filtering
    const registry = await fetchRegistry();
    const q = query.toLowerCase();
    return registry.filter(
      (e) =>
        e.name.toLowerCase().includes(q) ||
        e.description.toLowerCase().includes(q) ||
        e.tags.some((t) => t.toLowerCase().includes(q))
    );
  }
}

export async function getRegistryEntry(name: string): Promise<RegistryEntry | null> {
  const registry = await fetchRegistry();
  return registry.find((e) => e.name === name) ?? null;
}

export async function getRegistryEntryById(id: number): Promise<RegistryEntry | null> {
  try {
    const res = await fetch(`${REGISTRY_API}/skills/${id}?install=true`);
    if (!res.ok) return null;
    const data = (await res.json()) as { skill: any };
    const s = data.skill;
    return {
      ...s,
      tags: parseTags(s.tags),
      secrets: parseSecrets(s.secrets),
    };
  } catch {
    return null;
  }
}
