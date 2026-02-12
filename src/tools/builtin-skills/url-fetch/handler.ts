export default async function (input: Record<string, unknown>): Promise<string> {
  const url = input.url as string;
  const maxLength = (input.maxLength as number) || 10000;

  const res = await fetch(url, {
    headers: {
      "User-Agent": "Orba/1.0",
      Accept: "text/html, application/json, text/plain, */*",
    },
    redirect: "follow",
    signal: AbortSignal.timeout(30000),
  });

  if (!res.ok) {
    throw new Error(`Fetch failed: ${res.status} ${res.statusText}`);
  }

  const contentType = res.headers.get("content-type") || "";
  let text = await res.text();

  // Strip HTML tags for HTML content
  if (contentType.includes("text/html")) {
    // Remove script and style blocks
    text = text.replace(/<script[\s\S]*?<\/script>/gi, "");
    text = text.replace(/<style[\s\S]*?<\/style>/gi, "");
    // Remove all tags
    text = text.replace(/<[^>]+>/g, " ");
    // Collapse whitespace
    text = text.replace(/\s+/g, " ").trim();
  }

  if (text.length > maxLength) {
    text = text.slice(0, maxLength) + "\n\n[Truncated]";
  }

  return JSON.stringify({ url, contentType, length: text.length, content: text });
}
