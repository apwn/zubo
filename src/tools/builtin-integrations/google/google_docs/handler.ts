import { safeApiError, safeExceptionError } from "../../api-helpers.js";

const API = "https://docs.googleapis.com/v1/documents";

export default async function (input: Record<string, unknown>): Promise<string> {
  const token = (globalThis as any).Zubo?.getSecret?.("google_api_key");
  if (!token) {
    return JSON.stringify({
      error: "Google API key not configured. Use secret_set to store a 'google_api_key' or connect_service to set up Google.",
    });
  }

  const { action, document_id, title, text, index } = input as {
    action: string;
    document_id?: string;
    title?: string;
    text?: string;
    index?: number;
  };

  const headers: Record<string, string> = {
    Authorization: `Bearer ${token}`,
    "Content-Type": "application/json",
  };

  try {
    switch (action) {
      case "create": {
        if (!title) return JSON.stringify({ error: "title is required for create" });
        const res = await fetch(API, {
          method: "POST",
          headers,
          body: JSON.stringify({ title }),
        });
        if (!res.ok) return await safeApiError(res, "Google");
        const doc = (await res.json()) as any;
        return JSON.stringify({
          document_id: doc.documentId,
          title: doc.title,
          url: `https://docs.google.com/document/d/${doc.documentId}/edit`,
        });
      }

      case "read": {
        if (!document_id) return JSON.stringify({ error: "document_id is required for read" });
        const res = await fetch(`${API}/${document_id}`, { headers });
        if (!res.ok) return await safeApiError(res, "Google");
        const doc = (await res.json()) as any;
        // Extract plain text from doc body
        let content = "";
        if (doc.body?.content) {
          for (const element of doc.body.content) {
            if (element.paragraph?.elements) {
              for (const e of element.paragraph.elements) {
                if (e.textRun?.content) content += e.textRun.content;
              }
            }
          }
        }
        return JSON.stringify({
          document_id: doc.documentId,
          title: doc.title,
          content: content.trim(),
        });
      }

      case "update": {
        if (!document_id) return JSON.stringify({ error: "document_id is required for update" });
        if (!text) return JSON.stringify({ error: "text is required for update" });
        const res = await fetch(`${API}/${document_id}:batchUpdate`, {
          method: "POST",
          headers,
          body: JSON.stringify({
            requests: [
              {
                insertText: {
                  text,
                  location: { index: index ?? 1 },
                },
              },
            ],
          }),
        });
        if (!res.ok) return await safeApiError(res, "Google");
        return JSON.stringify({ success: true, message: "Document updated." });
      }

      default:
        return JSON.stringify({ error: `Unknown action: ${action}` });
    }
  } catch (err: any) {
    return safeExceptionError(err, "Google");
  }
}
