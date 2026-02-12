export default async function (input: Record<string, unknown>): Promise<string> {
  const url = input.url as string;
  const method = ((input.method as string) || "GET").toUpperCase();
  const headers = (input.headers as Record<string, string>) || {};
  const body = input.body as string | undefined;

  const opts: RequestInit = {
    method,
    headers: {
      "User-Agent": "Orba/1.0",
      ...headers,
    },
    redirect: "follow",
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
