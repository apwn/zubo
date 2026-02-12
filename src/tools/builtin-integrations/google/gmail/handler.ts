import { safeApiError, safeExceptionError } from "../../api-helpers.js";

const API = "https://gmail.googleapis.com/gmail/v1/users/me";

export default async function (input: Record<string, unknown>): Promise<string> {
  const token = (globalThis as any).Zubo?.getSecret?.("gmail_token");
  if (!token) {
    return JSON.stringify({ error: "Gmail token not configured. Use secret_set to store 'gmail_token'." });
  }

  const { action, message_id, to, subject, body, query, max_results } = input as {
    action: string; message_id?: string; to?: string; subject?: string;
    body?: string; query?: string; max_results?: number;
  };

  const headers: Record<string, string> = {
    Authorization: `Bearer ${token}`,
    "Content-Type": "application/json",
  };

  try {
    switch (action) {
      case "list": {
        const res = await fetch(`${API}/messages?maxResults=${max_results || 10}`, { headers });
        if (!res.ok) return await safeApiError(res, "Gmail");
        const data = (await res.json()) as any;
        const summaries = [];
        for (const msg of (data.messages || []).slice(0, 10)) {
          const detail = await fetch(`${API}/messages/${msg.id}?format=metadata&metadataHeaders=Subject&metadataHeaders=From&metadataHeaders=Date`, { headers });
          if (detail.ok) {
            const d = (await detail.json()) as any;
            const getHeader = (name: string) => d.payload?.headers?.find((h: any) => h.name === name)?.value ?? "";
            summaries.push({ id: msg.id, subject: getHeader("Subject"), from: getHeader("From"), date: getHeader("Date"), snippet: d.snippet });
          }
        }
        return JSON.stringify(summaries);
      }
      case "read": {
        if (!message_id) return JSON.stringify({ error: "message_id required" });
        const res = await fetch(`${API}/messages/${message_id}?format=full`, { headers });
        if (!res.ok) return await safeApiError(res, "Gmail");
        const data = (await res.json()) as any;
        const getHeader = (name: string) => data.payload?.headers?.find((h: any) => h.name === name)?.value ?? "";
        let emailBody = data.snippet || "";
        // Try to decode body
        const parts = data.payload?.parts || [data.payload];
        for (const part of parts) {
          if (part?.mimeType === "text/plain" && part?.body?.data) {
            emailBody = Buffer.from(part.body.data, "base64url").toString("utf-8");
            break;
          }
        }
        return JSON.stringify({ id: data.id, subject: getHeader("Subject"), from: getHeader("From"), date: getHeader("Date"), body: emailBody });
      }
      case "send": {
        if (!to) return JSON.stringify({ error: "to is required" });
        if (!subject) return JSON.stringify({ error: "subject is required" });
        const raw = Buffer.from(`To: ${to}\r\nSubject: ${subject}\r\nContent-Type: text/plain; charset=utf-8\r\n\r\n${body || ""}`).toString("base64url");
        const res = await fetch(`${API}/messages/send`, {
          method: "POST", headers,
          body: JSON.stringify({ raw }),
        });
        if (!res.ok) return await safeApiError(res, "Gmail");
        const data = (await res.json()) as any;
        return JSON.stringify({ sent: true, id: data.id });
      }
      case "search": {
        if (!query) return JSON.stringify({ error: "query is required" });
        const res = await fetch(`${API}/messages?q=${encodeURIComponent(query)}&maxResults=${max_results || 10}`, { headers });
        if (!res.ok) return await safeApiError(res, "Gmail");
        const data = (await res.json()) as any;
        return JSON.stringify({ resultCount: data.resultSizeEstimate, messages: data.messages?.map((m: any) => m.id) ?? [] });
      }
      case "reply": {
        if (!message_id) return JSON.stringify({ error: "message_id required" });
        if (!body) return JSON.stringify({ error: "body required" });
        const orig = await fetch(`${API}/messages/${message_id}?format=metadata&metadataHeaders=Subject&metadataHeaders=From&metadataHeaders=Message-ID`, { headers });
        if (!orig.ok) return await safeApiError(orig, "Gmail");
        const origData = (await orig.json()) as any;
        const getHeader = (name: string) => origData.payload?.headers?.find((h: any) => h.name === name)?.value ?? "";
        const replyTo = getHeader("From");
        const subj = getHeader("Subject").startsWith("Re:") ? getHeader("Subject") : `Re: ${getHeader("Subject")}`;
        const msgId = getHeader("Message-ID");
        const raw = Buffer.from(`To: ${replyTo}\r\nSubject: ${subj}\r\nIn-Reply-To: ${msgId}\r\nReferences: ${msgId}\r\nContent-Type: text/plain; charset=utf-8\r\n\r\n${body}`).toString("base64url");
        const res = await fetch(`${API}/messages/send`, {
          method: "POST", headers,
          body: JSON.stringify({ raw, threadId: origData.threadId }),
        });
        if (!res.ok) return await safeApiError(res, "Gmail");
        const data = (await res.json()) as any;
        return JSON.stringify({ replied: true, id: data.id });
      }
      default:
        return JSON.stringify({ error: `Unknown action: ${action}` });
    }
  } catch (err: any) {
    return safeExceptionError(err, "Gmail");
  }
}
