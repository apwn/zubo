export default async function (input: Record<string, unknown>): Promise<string> {
  const query = input.query as string;
  const maxResults = (input.maxResults as number) || 5;

  const url = `https://html.duckduckgo.com/html/?q=${encodeURIComponent(query)}`;

  const res = await fetch(url, {
    headers: {
      "User-Agent": "Zubo/1.0",
    },
    signal: AbortSignal.timeout(15000),
  });

  if (!res.ok) {
    throw new Error(`Search failed (${res.status}). Try again in a moment.`);
  }

  const html = await res.text();

  // Parse results from DuckDuckGo HTML
  const results: { title: string; url: string; snippet: string }[] = [];
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
    } catch (err: any) {
      // URL parsing is non-critical; fall back to rawUrl
    }

    if (title) {
      results.push({ title, url: finalUrl, snippet });
    }
  }

  if (results.length === 0) {
    return JSON.stringify({ query, results: [], message: "No results found." });
  }

  return JSON.stringify({ query, results });
}
