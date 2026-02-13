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
  const token = (globalThis as any).Zubo?.getSecret?.("notion_token");
  if (!token) {
    return JSON.stringify({
      error: "Notion token not configured. Use secret_set to store a 'notion_token' or connect_service to set up Notion.",
    });
  }

  const { query, filter_type, page_size } = input as {
    query: string;
    filter_type?: string;
    page_size?: number;
  };

  const headers: Record<string, string> = {
    Authorization: `Bearer ${token}`,
    "Content-Type": "application/json",
    "Notion-Version": "2022-06-28",
  };

  try {
    const body: any = {
      query,
      page_size: page_size || 20,
    };
    if (filter_type) {
      body.filter = { value: filter_type, property: "object" };
    }

    const res = await fetch(`${API}/search`, {
      method: "POST",
      headers,
      body: JSON.stringify(body),
    });
    if (!res.ok) return await safeApiError(res, "Notion");
    const data = (await res.json()) as any;

    return JSON.stringify({
      results: (data.results || []).map((r: any) => ({
        id: r.id,
        type: r.object,
        url: r.url,
        title:
          r.properties?.title?.title?.[0]?.plain_text ||
          r.properties?.Name?.title?.[0]?.plain_text ||
          r.title?.[0]?.plain_text ||
          "(untitled)",
        created_time: r.created_time,
        last_edited_time: r.last_edited_time,
      })),
      has_more: data.has_more,
    });
  } catch (err: any) {
    return safeExceptionError(err, "Notion");
  }
}
