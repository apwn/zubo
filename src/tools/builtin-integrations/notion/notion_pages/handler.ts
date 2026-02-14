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

  const { action, page_id, parent_page_id, parent_database_id, title, content, properties } =
    input as {
      action: string;
      page_id?: string;
      parent_page_id?: string;
      parent_database_id?: string;
      title?: string;
      content?: string;
      properties?: Record<string, unknown>;
    };

  const headers: Record<string, string> = {
    Authorization: `Bearer ${token}`,
    "Content-Type": "application/json",
    "Notion-Version": "2022-06-28",
  };

  try {
    switch (action) {
      case "create": {
        if (!title) return JSON.stringify({ error: "title is required for create" });
        const parent = parent_database_id
          ? { database_id: parent_database_id }
          : parent_page_id
            ? { page_id: parent_page_id }
            : null;
        if (!parent) return JSON.stringify({ error: "parent_page_id or parent_database_id is required" });

        const body: any = {
          parent,
          properties: properties || {
            title: { title: [{ text: { content: title } }] },
          },
        };

        if (content) {
          body.children = [
            {
              object: "block",
              type: "paragraph",
              paragraph: {
                rich_text: [{ type: "text", text: { content } }],
              },
            },
          ];
        }

        const res = await fetch(`${API}/pages`, {
          method: "POST",
          headers,
          body: JSON.stringify(body),
        });
        if (!res.ok) return await safeApiError(res, "Notion");
        const page = (await res.json()) as any;
        return JSON.stringify({ id: page.id, url: page.url, created_time: page.created_time });
      }

      case "read": {
        if (!page_id) return JSON.stringify({ error: "page_id is required for read" });
        // Get page properties
        const pageRes = await fetch(`${API}/pages/${page_id}`, { headers });
        if (!pageRes.ok) return await safeApiError(pageRes, "Notion");
        const page = (await pageRes.json()) as any;

        // Get page content (blocks)
        const blocksRes = await fetch(`${API}/blocks/${page_id}/children?page_size=100`, { headers });
        let blocks: any[] = [];
        if (blocksRes.ok) {
          const blocksData = (await blocksRes.json()) as any;
          blocks = blocksData.results || [];
        }

        // Extract text from blocks
        const textParts: string[] = [];
        for (const block of blocks) {
          const richText = block[block.type]?.rich_text;
          if (richText) {
            textParts.push(richText.map((t: any) => t.plain_text).join(""));
          }
        }

        return JSON.stringify({
          id: page.id,
          url: page.url,
          properties: page.properties,
          content: textParts.join("\n"),
        });
      }

      case "update": {
        if (!page_id) return JSON.stringify({ error: "page_id is required for update" });
        if (!properties) return JSON.stringify({ error: "properties are required for update" });
        const res = await fetch(`${API}/pages/${page_id}`, {
          method: "PATCH",
          headers,
          body: JSON.stringify({ properties }),
        });
        if (!res.ok) return await safeApiError(res, "Notion");
        const page = (await res.json()) as any;
        return JSON.stringify({ id: page.id, url: page.url, message: "Page updated." });
      }

      default:
        return JSON.stringify({ error: `Unknown action: ${action}` });
    }
  } catch (err: any) {
    return safeExceptionError(err, "Notion");
  }
}
