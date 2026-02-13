const API = "https://www.googleapis.com/drive/v3";

async function getToken(): Promise<string> {
  const Zubo = (globalThis as any).Zubo;
  if (Zubo?.getGoogleToken) return Zubo.getGoogleToken();
  throw new Error("Google is not connected. Ask me to set up Google and I'll walk you through it.");
}

function safeApiErr(status: number, statusText: string, service: string): string {
  return JSON.stringify({ error: `${service} API error: ${status} ${statusText}` });
}

export default async function (input: Record<string, unknown>): Promise<string> {
  let token: string;
  try {
    token = await getToken();
  } catch (err: any) {
    return JSON.stringify({
      error: err.message,
      action_required: "Google is not connected. The user needs to set up Google OAuth. " +
        "Ask them for their Google OAuth client_id (ends with .apps.googleusercontent.com) " +
        "and client_secret (starts with GOCSPX-), then use google_oauth tool with action 'start'.",
    });
  }

  const { action, file_id, name, parent_id, query, page_size } = input as {
    action: string;
    file_id?: string;
    name?: string;
    parent_id?: string;
    query?: string;
    page_size?: number;
  };

  const headers: Record<string, string> = {
    Authorization: `Bearer ${token}`,
    "Content-Type": "application/json",
  };

  try {
    switch (action) {
      case "list": {
        const qs = new URLSearchParams({
          pageSize: String(page_size || 20),
          fields: "files(id,name,mimeType,size,modifiedTime,webViewLink)",
        });
        if (query) qs.set("q", query);
        const res = await fetch(`${API}/files?${qs}`, { headers });
        if (!res.ok) return safeApiErr(res.status, res.statusText, "Google Drive");
        const data = (await res.json()) as any;
        return JSON.stringify(
          (data.files || []).map((f: any) => ({
            id: f.id,
            name: f.name,
            type: f.mimeType,
            size: f.size,
            modified: f.modifiedTime,
            url: f.webViewLink,
          }))
        );
      }

      case "create_folder": {
        if (!name) return JSON.stringify({ error: "name is required for create_folder" });
        const metadata: any = {
          name,
          mimeType: "application/vnd.google-apps.folder",
        };
        if (parent_id) metadata.parents = [parent_id];
        const res = await fetch(`${API}/files`, {
          method: "POST",
          headers,
          body: JSON.stringify(metadata),
        });
        if (!res.ok) return safeApiErr(res.status, res.statusText, "Google Drive");
        const folder = (await res.json()) as any;
        return JSON.stringify({ id: folder.id, name: folder.name });
      }

      case "get": {
        if (!file_id) return JSON.stringify({ error: "file_id is required for get" });
        const qs = new URLSearchParams({
          fields: "id,name,mimeType,size,modifiedTime,webViewLink,description",
        });
        const res = await fetch(`${API}/files/${file_id}?${qs}`, { headers });
        if (!res.ok) return safeApiErr(res.status, res.statusText, "Google Drive");
        const f = (await res.json()) as any;
        return JSON.stringify({
          id: f.id,
          name: f.name,
          type: f.mimeType,
          size: f.size,
          modified: f.modifiedTime,
          description: f.description,
          url: f.webViewLink,
        });
      }

      default:
        return JSON.stringify({ error: `Unknown action: ${action}` });
    }
  } catch (err: any) {
    console.error(`[Google Drive] Request failed: ${err.message}`);
    return JSON.stringify({ error: "Google Drive request failed. Check logs for details." });
  }
}
