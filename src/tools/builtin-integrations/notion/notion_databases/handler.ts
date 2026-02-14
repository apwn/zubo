async function safeApiError(res: Response, service: string): Promise<string> {
  const body = await res.text().catch(() => "");
  console.error(`[${service}] API error ${res.status}: ${body.slice(0, 500)}`);
  return JSON.stringify({ error: `${service} API error: ${res.status} ${res.statusText}` });
}

function safeExceptionError(err: any, service: string): string {
  console.error(`[${service}] Request failed: ${err.message}`);
  return JSON.stringify({ error: `${service} request failed. Check logs for details.` });
}

const API = "https://api.notion.com/v1";

export default async function (input: Record<string, unknown>): Promise<string> {
  // Try OAuth token first, then fall back to API key
  let token: string | null = null;
  try {
    const { getOAuthTokenForIntegration } = await import("../../../oauth");
    token = await getOAuthTokenForIntegration("notion");
  } catch {}
  if (!token) {
    token = (globalThis as any).Zubo?.getSecret?.("notion_token") ?? null;
  }
  if (!token) {
    return JSON.stringify({
      error: "Notion is not connected. Use oauth_manage with provider 'notion' to connect via OAuth, or use secret_set to store a 'notion_token'.",
    });
  }

  const { action, database_id, filter, sorts, properties, page_size } = input as {
    action: string;
    database_id: string;
    filter?: Record<string, unknown>;
    sorts?: unknown[];
    properties?: Record<string, unknown>;
    page_size?: number;
  };

  const headers: Record<string, string> = {
    Authorization: `Bearer ${token}`,
    "Content-Type": "application/json",
    "Notion-Version": "2022-06-28",
  };

  try {
    switch (action) {
      case "query": {
        const body: any = { page_size: page_size || 20 };
        if (filter) body.filter = filter;
        if (sorts) body.sorts = sorts;

        const res = await fetch(`${API}/databases/${database_id}/query`, {
          method: "POST",
          headers,
          body: JSON.stringify(body),
        });
        if (!res.ok) return await safeApiError(res, "Notion");
        const data = (await res.json()) as any;
        return JSON.stringify({
          results: (data.results || []).map((r: any) => ({
            id: r.id,
            url: r.url,
            properties: r.properties,
            created_time: r.created_time,
          })),
          has_more: data.has_more,
        });
      }

      case "create_entry": {
        if (!properties) return JSON.stringify({ error: "properties are required for create_entry" });
        const res = await fetch(`${API}/pages`, {
          method: "POST",
          headers,
          body: JSON.stringify({
            parent: { database_id },
            properties,
          }),
        });
        if (!res.ok) return await safeApiError(res, "Notion");
        const page = (await res.json()) as any;
        return JSON.stringify({ id: page.id, url: page.url, created_time: page.created_time });
      }

      default:
        return JSON.stringify({ error: `Unknown action: ${action}` });
    }
  } catch (err: any) {
    return safeExceptionError(err, "Notion");
  }
}
