import { readFileSync } from "fs";
import { homedir } from "os";
import { join } from "path";

interface SearchResult {
  title: string;
  url: string;
  snippet: string;
}

function loadBraveApiKey(): string | null {
  try {
    const secretsPath = join(homedir(), ".zubo", "secrets.json");
    const raw = readFileSync(secretsPath, "utf-8");
    const secrets = JSON.parse(raw);
    return secrets.BRAVE_API_KEY || null;
  } catch {
    return null;
  }
}

async function searchBrave(
  query: string,
  maxResults: number,
  apiKey: string,
): Promise<SearchResult[]> {
  const url = `https://api.search.brave.com/res/v1/web/search?q=${encodeURIComponent(query)}&count=${maxResults}`;

  const res = await fetch(url, {
    headers: {
      Accept: "application/json",
      "X-Subscription-Token": apiKey,
    },
    signal: AbortSignal.timeout(15000),
  });

  if (!res.ok) {
    throw new Error(`Brave Search API returned ${res.status}`);
  }

  const data = (await res.json()) as {
    web?: { results: { title: string; url: string; description: string }[] };
  };

  const webResults = data.web?.results ?? [];
  return webResults.map((r) => ({
    title: r.title,
    url: r.url,
    snippet: r.description,
  }));
}

async function searchDuckDuckGo(
  query: string,
  maxResults: number,
): Promise<SearchResult[]> {
  const url = `https://html.duckduckgo.com/html/?q=${encodeURIComponent(query)}`;

  const res = await fetch(url, {
    headers: {
      "User-Agent": "Zubo/1.0",
    },
    signal: AbortSignal.timeout(15000),
  });

  if (!res.ok) {
    throw new Error(`DuckDuckGo search failed (${res.status}).`);
  }

  const html = await res.text();

  const results: SearchResult[] = [];
  const resultRegex =
    /<a rel="nofollow" class="result__a" href="([^"]*)"[^>]*>([\s\S]*?)<\/a>[\s\S]*?<a class="result__snippet"[^>]*>([\s\S]*?)<\/a>/g;

  let match;
  while ((match = resultRegex.exec(html)) !== null && results.length < maxResults) {
    const rawUrl = match[1];
    const title = match[2].replace(/<[^>]+>/g, "").trim();
    const snippet = match[3].replace(/<[^>]+>/g, "").trim();

    // DuckDuckGo wraps URLs in a redirect — extract the actual URL
    let finalUrl = rawUrl;
    try {
      const parsed = new URL(rawUrl, "https://duckduckgo.com");
      finalUrl = parsed.searchParams.get("uddg") || rawUrl;
    } catch {
      // URL parsing is non-critical; fall back to rawUrl
    }

    if (title) {
      results.push({ title, url: finalUrl, snippet });
    }
  }

  return results;
}

export default async function (input: Record<string, unknown>): Promise<string> {
  const query = input.query as string;
  const maxResults = (input.maxResults as number) || 5;

  const braveKey = loadBraveApiKey();

  // Primary: try Brave Search if API key is available
  if (braveKey) {
    try {
      const results = await searchBrave(query, maxResults, braveKey);
      if (results.length === 0) {
        return JSON.stringify({ query, results: [], message: "No results found." });
      }
      return JSON.stringify({ query, results });
    } catch {
      // Brave failed — fall through to DuckDuckGo
    }
  }

  // Fallback: DuckDuckGo HTML scraping
  const results = await searchDuckDuckGo(query, maxResults);

  if (results.length === 0) {
    return JSON.stringify({ query, results: [], message: "No results found." });
  }

  return JSON.stringify({ query, results });
}
