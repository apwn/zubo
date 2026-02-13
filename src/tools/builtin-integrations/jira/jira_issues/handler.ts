async function safeApiError(res: Response, service: string): Promise<string> {
  const body = await res.text().catch(() => "");
  console.error(`[${service}] API error ${res.status}: ${body.slice(0, 500)}`);
  return JSON.stringify({ error: `${service} API error: ${res.status} ${res.statusText}` });
}

function safeExceptionError(err: any, service: string): string {
  console.error(`[${service}] Request failed: ${err.message}`);
  return JSON.stringify({ error: `${service} request failed. Check logs for details.` });
}

export default async function (input: Record<string, unknown>): Promise<string> {
  const token = (globalThis as any).Zubo?.getSecret?.("jira_token");
  const email = (globalThis as any).Zubo?.getSecret?.("jira_email");
  const baseUrl = (globalThis as any).Zubo?.getSecret?.("jira_url");
  if (!token || !email || !baseUrl) {
    return JSON.stringify({ error: "Jira not configured. Set jira_token, jira_email, and jira_url secrets." });
  }

  // Validate jira_url to prevent SSRF — must be HTTPS and a valid Jira host
  let parsedUrl: URL;
  try {
    parsedUrl = new URL(baseUrl);
  } catch {
    return JSON.stringify({ error: "Invalid jira_url format" });
  }
  if (parsedUrl.protocol !== "https:") {
    return JSON.stringify({ error: "jira_url must use HTTPS" });
  }
  // Block private/internal IP ranges
  const hostname = parsedUrl.hostname;
  const is172Private = hostname.startsWith("172.") && (() => {
    const secondOctet = parseInt(hostname.split(".")[1], 10);
    return secondOctet >= 16 && secondOctet <= 31;
  })();
  if (hostname === "localhost" || hostname.startsWith("127.") || hostname.startsWith("10.") ||
      hostname.startsWith("192.168.") || is172Private || hostname === "[::1]" ||
      hostname.endsWith(".local") || hostname.endsWith(".internal")) {
    return JSON.stringify({ error: "jira_url must not point to internal/private addresses" });
  }

  const { action, issue_key, project_key, summary, description, issue_type, jql, transition_id } = input as {
    action: string; issue_key?: string; project_key?: string; summary?: string;
    description?: string; issue_type?: string; jql?: string; transition_id?: string;
  };

  // Validate issue_key format to prevent path traversal (e.g. "PROJ-123")
  if (issue_key && !/^[A-Z][A-Z0-9_]+-\d+$/i.test(issue_key)) {
    return JSON.stringify({ error: "Invalid issue_key format. Expected format: PROJ-123" });
  }
  // Validate project_key format
  if (project_key && !/^[A-Z][A-Z0-9_]*$/i.test(project_key)) {
    return JSON.stringify({ error: "Invalid project_key format. Expected format: PROJ" });
  }

  const api = parsedUrl.origin + parsedUrl.pathname.replace(/\/+$/, "") + "/rest/api/3";
  const auth = Buffer.from(`${email}:${token}`).toString("base64");
  const headers: Record<string, string> = {
    Authorization: `Basic ${auth}`,
    "Content-Type": "application/json",
    Accept: "application/json",
  };

  try {
    switch (action) {
      case "list": {
        const q = project_key ? `project=${project_key} ORDER BY created DESC` : "ORDER BY created DESC";
        const res = await fetch(`${api}/search?jql=${encodeURIComponent(q)}&maxResults=20`, { headers });
        if (!res.ok) return await safeApiError(res, "Jira");
        const data = (await res.json()) as any;
        return JSON.stringify(data.issues?.map((i: any) => ({
          key: i.key, summary: i.fields.summary, status: i.fields.status?.name,
          assignee: i.fields.assignee?.displayName, priority: i.fields.priority?.name,
        })) ?? []);
      }
      case "create": {
        if (!project_key || !summary) return JSON.stringify({ error: "project_key and summary required" });
        const res = await fetch(`${api}/issue`, {
          method: "POST", headers,
          body: JSON.stringify({
            fields: {
              project: { key: project_key },
              summary,
              description: description ? { type: "doc", version: 1, content: [{ type: "paragraph", content: [{ type: "text", text: description }] }] } : undefined,
              issuetype: { name: issue_type || "Task" },
            },
          }),
        });
        if (!res.ok) return await safeApiError(res, "Jira");
        const data = (await res.json()) as any;
        return JSON.stringify({ key: data.key, id: data.id, self: data.self });
      }
      case "get": {
        if (!issue_key) return JSON.stringify({ error: "issue_key required" });
        const res = await fetch(`${api}/issue/${issue_key}`, { headers });
        if (!res.ok) return await safeApiError(res, "Jira");
        const i = (await res.json()) as any;
        return JSON.stringify({
          key: i.key, summary: i.fields.summary, status: i.fields.status?.name,
          assignee: i.fields.assignee?.displayName, priority: i.fields.priority?.name,
          description: i.fields.description, created: i.fields.created,
        });
      }
      case "update": {
        if (!issue_key) return JSON.stringify({ error: "issue_key required" });
        const fields: any = {};
        if (summary) fields.summary = summary;
        if (description) fields.description = { type: "doc", version: 1, content: [{ type: "paragraph", content: [{ type: "text", text: description }] }] };
        const res = await fetch(`${api}/issue/${issue_key}`, {
          method: "PUT", headers,
          body: JSON.stringify({ fields }),
        });
        if (!res.ok) return await safeApiError(res, "Jira");
        return JSON.stringify({ updated: true, key: issue_key });
      }
      case "search": {
        if (!jql) return JSON.stringify({ error: "jql required" });
        const res = await fetch(`${api}/search?jql=${encodeURIComponent(jql)}&maxResults=20`, { headers });
        if (!res.ok) return await safeApiError(res, "Jira");
        const data = (await res.json()) as any;
        return JSON.stringify(data.issues?.map((i: any) => ({
          key: i.key, summary: i.fields.summary, status: i.fields.status?.name,
        })) ?? []);
      }
      case "transition": {
        if (!issue_key || !transition_id) return JSON.stringify({ error: "issue_key and transition_id required" });
        const res = await fetch(`${api}/issue/${issue_key}/transitions`, {
          method: "POST", headers,
          body: JSON.stringify({ transition: { id: transition_id } }),
        });
        if (!res.ok) return await safeApiError(res, "Jira");
        return JSON.stringify({ transitioned: true, key: issue_key });
      }
      default:
        return JSON.stringify({ error: `Unknown action: ${action}` });
    }
  } catch (err: any) {
    return safeExceptionError(err, "Jira");
  }
}
