const API = "https://api.notion.com/v1";

export default async function (input: Record<string, unknown>): Promise<string> {
  const token = (globalThis as any).Zubo?.getSecret?.("notion_token");
  if (!token) {
    return JSON.stringify({
      error: "Notion token not configured. Use secret_set to store a 'notion_token' or connect_service to set up Notion.",
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
        if (!res.ok) return JSON.stringify({ error: `Notion API error: ${res.status} ${await res.text()}` });
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
        if (!res.ok) return JSON.stringify({ error: `Notion API error: ${res.status} ${await res.text()}` });
        const page = (await res.json()) as any;
        return JSON.stringify({ id: page.id, url: page.url, created_time: page.created_time });
      }

      default:
        return JSON.stringify({ error: `Unknown action: ${action}` });
    }
  } catch (err: any) {
    return JSON.stringify({ error: `Request failed: ${err.message}` });
  }
}
