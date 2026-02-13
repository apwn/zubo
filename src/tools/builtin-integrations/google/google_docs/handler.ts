const API = "https://docs.googleapis.com/v1/documents";

async function getToken(): Promise<string> {
  const Zubo = (globalThis as any).Zubo;
  if (Zubo?.getGoogleToken) return Zubo.getGoogleToken();
  throw new Error("Google is NOT connected. Use google_oauth with action 'start' to set up Google.");
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
      action_required: "Google is NOT connected. The user needs to complete the OAuth 2.0 flow. " +
        "Ask the user for their Google OAuth client_id (ends with .apps.googleusercontent.com) " +
        "and client_secret (starts with GOCSPX-), then use google_oauth tool with action 'start'.",
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
        if (!res.ok) return safeApiErr(res.status, res.statusText, "Google Docs");
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
        if (!res.ok) return safeApiErr(res.status, res.statusText, "Google Docs");
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
        if (!res.ok) return safeApiErr(res.status, res.statusText, "Google Docs");
        return JSON.stringify({ success: true, message: "Document updated." });
      }

      default:
        return JSON.stringify({ error: `Unknown action: ${action}` });
    }
  } catch (err: any) {
    console.error(`[Google Docs] Request failed: ${err.message}`);
    return JSON.stringify({ error: "Google Docs request failed. Check logs for details." });
  }
}
