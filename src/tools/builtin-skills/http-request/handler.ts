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
];

function validateUrl(raw: string): void {
  let parsed: URL;
  try {
    parsed = new URL(raw);
  } catch {
    throw new Error(`Invalid URL: ${raw}`);
  }

  const hostname = parsed.hostname.replace(/^\[|\]$/g, "");
  for (const pattern of BLOCKED_HOST_PATTERNS) {
    if (pattern.test(hostname)) {
      throw new Error(`Blocked: requests to internal/private addresses are not allowed`);
    }
  }
}

export default async function (input: Record<string, unknown>): Promise<string> {
  const url = input.url as string;
  const method = ((input.method as string) || "GET").toUpperCase();
  const headers = (input.headers as Record<string, string>) || {};
  const body = input.body as string | undefined;

  validateUrl(url);

  const opts: RequestInit = {
    method,
    headers: {
      "User-Agent": "Zubo/1.0",
      ...headers,
    },
    redirect: "follow",
    signal: AbortSignal.timeout(30000),
  };

  if (body && ["POST", "PUT", "PATCH"].includes(method)) {
    opts.body = body;
    if (!headers["Content-Type"] && !headers["content-type"]) {
      (opts.headers as Record<string, string>)["Content-Type"] = "application/json";
    }
  }

  const res = await fetch(url, opts);
  const responseText = await res.text();

  return JSON.stringify({
    status: res.status,
    statusText: res.statusText,
    headers: Object.fromEntries(res.headers.entries()),
    body: responseText.slice(0, 50000),
  });
}
