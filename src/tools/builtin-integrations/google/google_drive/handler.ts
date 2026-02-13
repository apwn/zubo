import { safeApiError, safeExceptionError } from "../../api-helpers.js";
import { getGoogleAccessToken } from "../../../../util/google-tokens";

const API = "https://www.googleapis.com/drive/v3";

export default async function (input: Record<string, unknown>): Promise<string> {
  let token: string;
  try {
    token = await getGoogleAccessToken();
  } catch (err: any) {
    return JSON.stringify({ error: err.message });
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
        if (!res.ok) return await safeApiError(res, "Google");
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
        if (!res.ok) return await safeApiError(res, "Google");
        const folder = (await res.json()) as any;
        return JSON.stringify({ id: folder.id, name: folder.name });
      }

      case "get": {
        if (!file_id) return JSON.stringify({ error: "file_id is required for get" });
        const qs = new URLSearchParams({
          fields: "id,name,mimeType,size,modifiedTime,webViewLink,description",
        });
        const res = await fetch(`${API}/files/${file_id}?${qs}`, { headers });
        if (!res.ok) return await safeApiError(res, "Google");
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
    return safeExceptionError(err, "Google");
  }
}
