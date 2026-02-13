const BLOCKED_HOST_PATTERNS = [
  /^localhost$/i,
  /^127\.\d+\.\d+\.\d+$/,
  /^10\.\d+\.\d+\.\d+$/,
  /^172\.(1[6-9]|2\d|3[01])\.\d+\.\d+$/,
  /^192\.168\.\d+\.\d+$/,
  /^169\.254\.\d+\.\d+$/,
  /^\[?::1\]?$/,
  /^0\.0\.0\.0$/,
  /^metadata\.google\.internal$/i,
  /^metadata\.azure\.com$/i,
  /^fe80:/i,
  /^fc00:/i,
];

function isBlockedHost(hostname: string): boolean {
  const normalized = hostname.replace(/^\[|\]$/g, "");
  for (const pattern of BLOCKED_HOST_PATTERNS) {
    if (pattern.test(normalized)) return true;
  }
  return false;
}

function validateUrl(raw: string): void {
  let parsed: URL;
  try {
    parsed = new URL(raw);
  } catch {
    throw new Error(`Invalid URL: "${raw}". Make sure it starts with http:// or https://`);
  }

  if (isBlockedHost(parsed.hostname)) {
    throw new Error(`Blocked: requests to internal/private addresses are not allowed`);
  }
}

export default async function (input: Record<string, unknown>): Promise<string> {
  const url = input.url as string;
  const method = ((input.method as string) || "GET").toUpperCase();
  const rawHeaders = (input.headers as Record<string, string>) || {};
  const body = input.body as string | undefined;

  validateUrl(url);

  // Strip non-ASCII characters from header values (HTTP/1.1 requires ASCII)
  const headers: Record<string, string> = {};
  for (const [key, value] of Object.entries(rawHeaders)) {
    headers[key] = String(value).replace(/[^\x20-\x7E]/g, "");
  }

  const opts: RequestInit = {
    method,
    headers: {
      "User-Agent": "Zubo/1.0",
      ...headers,
    },
    redirect: "manual",
    signal: AbortSignal.timeout(30000),
  };

  if (body && ["POST", "PUT", "PATCH"].includes(method)) {
    opts.body = body;
    if (!headers["Content-Type"] && !headers["content-type"]) {
      (opts.headers as Record<string, string>)["Content-Type"] = "application/json";
    }
  }

  let res = await fetch(url, opts);
  let redirectCount = 0;
  const MAX_REDIRECTS = 5;

  while (res.status >= 300 && res.status < 400 && redirectCount < MAX_REDIRECTS) {
    const location = res.headers.get("location");
    if (!location) break;

    const redirectUrl = new URL(location, url);
    if (isBlockedHost(redirectUrl.hostname)) {
      return JSON.stringify({ error: "Redirect to blocked host", status: 0 });
    }

    res = await fetch(redirectUrl.toString(), { ...opts, redirect: "manual" });
    redirectCount++;
  }

  const responseText = await res.text();

  return JSON.stringify({
    status: res.status,
    statusText: res.statusText,
    headers: Object.fromEntries(res.headers.entries()),
    body: responseText.slice(0, 50000),
  });
}
