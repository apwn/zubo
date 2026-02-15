const API = "https://gmail.googleapis.com/gmail/v1/users/me";

/** RFC 2047 encode a header value if it contains non-ASCII characters (e.g. emojis) */
function mimeEncode(value: string): string {
  if (/^[\x20-\x7E]*$/.test(value)) return value;
  return `=?UTF-8?B?${Buffer.from(value, "utf-8").toString("base64")}?=`;
}

async function getToken(): Promise<string> {
  // Try the new multi-provider OAuth system first
  try {
    const { getOAuthTokenForIntegration } = await import("../../../oauth");
    const oauthToken = await getOAuthTokenForIntegration("google");
    if (oauthToken) return oauthToken;
  } catch {}
  // Fall back to existing Google-specific OAuth
  const Zubo = (globalThis as any).Zubo;
  if (Zubo?.getGoogleToken) return Zubo.getGoogleToken();
  throw new Error("Google is not connected. Ask me to set up Google and I'll walk you through it.");
}

async function safeApiErr(res: Response, service: string): Promise<string> {
  const body = await res.text().catch(() => "");
  console.error(`[${service}] API error ${res.status}: ${body.slice(0, 500)}`);
  // Parse Google error for actionable info
  let hint = "";
  if (res.status === 403) {
    if (body.includes("Gmail API has not been used") || body.includes("accessNotConfigured")) {
      hint = " The Gmail API is not enabled in your Google Cloud Console. Go to console.cloud.google.com > APIs & Services > Library > search 'Gmail API' > Enable it.";
    } else if (body.includes("insufficientPermissions") || body.includes("Insufficient Permission")) {
      hint = " The access token does not have Gmail permissions. You may need to disconnect and reconnect Google (use google_oauth action 'disconnect' then 'start') to re-authorize with Gmail scope.";
    }
  }
  return JSON.stringify({ error: `${service} API error: ${res.status} ${res.statusText}.${hint}` });
}

export default async function (input: Record<string, unknown>): Promise<string> {
  let token: string;
  try {
    token = await getToken();
  } catch (err: any) {
    return JSON.stringify({
      error: err.message,
      action_required: "Google is not connected. Call google_oauth with action 'start' (no other parameters needed — it will use stored credentials automatically). Only ask the user for credentials if google_oauth returns an error saying they are missing.",
    });
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
        if (!res.ok) return await safeApiErr(res, "Gmail");
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
        if (!res.ok) return await safeApiErr(res, "Gmail");
        const data = (await res.json()) as any;
        const getHeader = (name: string) => data.payload?.headers?.find((h: any) => h.name === name)?.value ?? "";
        let emailBody = data.snippet || "";
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
        const raw = Buffer.from(`To: ${to}\r\nSubject: ${mimeEncode(subject)}\r\nContent-Type: text/plain; charset=utf-8\r\n\r\n${body || ""}`).toString("base64url");
        const res = await fetch(`${API}/messages/send`, {
          method: "POST", headers,
          body: JSON.stringify({ raw }),
        });
        if (!res.ok) return await safeApiErr(res, "Gmail");
        const data = (await res.json()) as any;
        return JSON.stringify({ sent: true, id: data.id });
      }
      case "search": {
        if (!query) return JSON.stringify({ error: "query is required" });
        const res = await fetch(`${API}/messages?q=${encodeURIComponent(query)}&maxResults=${max_results || 10}`, { headers });
        if (!res.ok) return await safeApiErr(res, "Gmail");
        const data = (await res.json()) as any;
        return JSON.stringify({ resultCount: data.resultSizeEstimate, messages: data.messages?.map((m: any) => m.id) ?? [] });
      }
      case "reply": {
        if (!message_id) return JSON.stringify({ error: "message_id required" });
        if (!body) return JSON.stringify({ error: "body required" });
        const orig = await fetch(`${API}/messages/${message_id}?format=metadata&metadataHeaders=Subject&metadataHeaders=From&metadataHeaders=Message-ID`, { headers });
        if (!orig.ok) return await safeApiErr(orig, "Gmail");
        const origData = (await orig.json()) as any;
        const getHeader = (name: string) => origData.payload?.headers?.find((h: any) => h.name === name)?.value ?? "";
        const replyTo = getHeader("From");
        const subj = getHeader("Subject").startsWith("Re:") ? getHeader("Subject") : `Re: ${getHeader("Subject")}`;
        const msgId = getHeader("Message-ID");
        const raw = Buffer.from(`To: ${replyTo}\r\nSubject: ${mimeEncode(subj)}\r\nIn-Reply-To: ${msgId}\r\nReferences: ${msgId}\r\nContent-Type: text/plain; charset=utf-8\r\n\r\n${body}`).toString("base64url");
        const res = await fetch(`${API}/messages/send`, {
          method: "POST", headers,
          body: JSON.stringify({ raw, threadId: origData.threadId }),
        });
        if (!res.ok) return await safeApiErr(res, "Gmail");
        const data = (await res.json()) as any;
        return JSON.stringify({ replied: true, id: data.id });
      }
      default:
        return JSON.stringify({ error: `Unknown action: ${action}` });
    }
  } catch (err: any) {
    console.error(`[Gmail] Request failed: ${err.message}`);
    return JSON.stringify({ error: "Gmail request failed. Check logs for details." });
  }
}
