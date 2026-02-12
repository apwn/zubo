import { safeApiError, safeExceptionError } from "../../api-helpers.js";

export default async function (input: Record<string, unknown>): Promise<string> {
  const token = (globalThis as any).Zubo?.getSecret?.("jira_token");
  const email = (globalThis as any).Zubo?.getSecret?.("jira_email");
  const baseUrl = (globalThis as any).Zubo?.getSecret?.("jira_url");
  if (!token || !email || !baseUrl) {
    return JSON.stringify({ error: "Jira not configured. Set jira_token, jira_email, and jira_url secrets." });
  }

  // Validate jira_url to prevent SSRF
  let parsedUrl: URL;
  try {
    parsedUrl = new URL(baseUrl);
  } catch {
    return JSON.stringify({ error: "Invalid jira_url format" });
  }
  if (parsedUrl.protocol !== "https:") {
    return JSON.stringify({ error: "jira_url must use HTTPS" });
  }
  const hostname = parsedUrl.hostname;
  if (hostname === "localhost" || hostname.startsWith("127.") || hostname.startsWith("10.") ||
      hostname.startsWith("192.168.") || hostname.startsWith("172.") || hostname === "[::1]" ||
      hostname.endsWith(".local") || hostname.endsWith(".internal")) {
    return JSON.stringify({ error: "jira_url must not point to internal/private addresses" });
  }

  const { action, board_id } = input as { action: string; board_id?: number };
  const api = parsedUrl.origin + parsedUrl.pathname.replace(/\/+$/, "") + "/rest/agile/1.0";
  const auth = Buffer.from(`${email}:${token}`).toString("base64");
  const headers: Record<string, string> = {
    Authorization: `Basic ${auth}`,
    Accept: "application/json",
  };

  try {
    switch (action) {
      case "list_boards": {
        const res = await fetch(`${api}/board?maxResults=50`, { headers });
        if (!res.ok) return await safeApiError(res, "Jira");
        const data = (await res.json()) as any;
        return JSON.stringify(data.values?.map((b: any) => ({ id: b.id, name: b.name, type: b.type })) ?? []);
      }
      case "list_sprints": {
        if (!board_id) return JSON.stringify({ error: "board_id required" });
        const res = await fetch(`${api}/board/${board_id}/sprint?maxResults=20`, { headers });
        if (!res.ok) return await safeApiError(res, "Jira");
        const data = (await res.json()) as any;
        return JSON.stringify(data.values?.map((s: any) => ({ id: s.id, name: s.name, state: s.state, startDate: s.startDate, endDate: s.endDate })) ?? []);
      }
      default:
        return JSON.stringify({ error: `Unknown action: ${action}` });
    }
  } catch (err: any) {
    return safeExceptionError(err, "Jira");
  }
}
