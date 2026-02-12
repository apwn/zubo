import { logger } from "../util/logger";

const REGISTRY_URL = "https://raw.githubusercontent.com/zubo-skills/registry/main/registry.json";
const CACHE_TTL_MS = 5 * 60_000; // 5 minutes

export interface RegistryEntry {
  name: string;
  description: string;
  repo: string;
  author: string;
  version: string;
  tags: string[];
  secrets?: string[];
}

let cachedRegistry: RegistryEntry[] | null = null;
let cacheTime = 0;

export async function fetchRegistry(): Promise<RegistryEntry[]> {
  const now = Date.now();
  if (cachedRegistry && now - cacheTime < CACHE_TTL_MS) {
    return cachedRegistry;
  }

  try {
    const res = await fetch(REGISTRY_URL);
    if (!res.ok) {
      throw new Error(`Registry fetch failed: ${res.status}`);
    }
    const data = (await res.json()) as { skills: RegistryEntry[] };
    cachedRegistry = data.skills ?? [];
    cacheTime = now;
    return cachedRegistry;
  } catch (err: any) {
    logger.warn("Failed to fetch skill registry", { error: err.message });
    return cachedRegistry ?? [];
  }
}

export async function searchRegistry(query: string): Promise<RegistryEntry[]> {
  const registry = await fetchRegistry();
  const q = query.toLowerCase();
  return registry.filter(
    (e) =>
      e.name.toLowerCase().includes(q) ||
      e.description.toLowerCase().includes(q) ||
      e.tags.some((t) => t.toLowerCase().includes(q))
  );
}

export async function getRegistryEntry(name: string): Promise<RegistryEntry | null> {
  const registry = await fetchRegistry();
  return registry.find((e) => e.name === name) ?? null;
}
