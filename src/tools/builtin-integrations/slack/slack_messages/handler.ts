import { safeApiError, safeExceptionError } from "../../api-helpers.js";

const API = "https://slack.com/api";

export default async function (input: Record<string, unknown>): Promise<string> {
  const token = (globalThis as any).Zubo?.getSecret?.("slack_token");
  if (!token) {
    return JSON.stringify({ error: "Slack token not configured. Use secret_set to store 'slack_token'." });
  }

  const { action, channel, text, query, limit } = input as {
    action: string; channel?: string; text?: string; query?: string; limit?: number;
  };

  const headers: Record<string, string> = {
    Authorization: `Bearer ${token}`,
    "Content-Type": "application/json; charset=utf-8",
  };

  try {
    switch (action) {
      case "list_channels": {
        const res = await fetch(`${API}/conversations.list?types=public_channel,private_channel&limit=${limit || 50}`, { headers });
        if (!res.ok) return await safeApiError(res, "Slack");
        const data = (await res.json()) as any;
        if (!data.ok) return JSON.stringify({ error: `Slack API error: ${data.error}` });
        return JSON.stringify(data.channels?.map((c: any) => ({ id: c.id, name: c.name, topic: c.topic?.value })) ?? []);
      }
      case "send": {
        if (!channel) return JSON.stringify({ error: "channel is required" });
        if (!text) return JSON.stringify({ error: "text is required" });
        const res = await fetch(`${API}/chat.postMessage`, {
          method: "POST", headers,
          body: JSON.stringify({ channel, text }),
        });
        if (!res.ok) return await safeApiError(res, "Slack");
        const data = (await res.json()) as any;
        if (!data.ok) return JSON.stringify({ error: `Slack API error: ${data.error}` });
        return JSON.stringify({ ok: true, ts: data.ts, channel: data.channel });
      }
      case "read": {
        if (!channel) return JSON.stringify({ error: "channel is required" });
        const res = await fetch(`${API}/conversations.history?channel=${channel}&limit=${limit || 20}`, { headers });
        if (!res.ok) return await safeApiError(res, "Slack");
        const data = (await res.json()) as any;
        if (!data.ok) return JSON.stringify({ error: `Slack API error: ${data.error}` });
        return JSON.stringify(data.messages?.map((m: any) => ({ user: m.user, text: m.text, ts: m.ts })) ?? []);
      }
      case "search": {
        if (!query) return JSON.stringify({ error: "query is required" });
        const res = await fetch(`${API}/search.messages?query=${encodeURIComponent(query)}&count=${limit || 20}`, { headers });
        if (!res.ok) return await safeApiError(res, "Slack");
        const data = (await res.json()) as any;
        if (!data.ok) return JSON.stringify({ error: `Slack API error: ${data.error}` });
        return JSON.stringify(data.messages?.matches?.map((m: any) => ({ text: m.text, user: m.user, channel: m.channel?.name, ts: m.ts })) ?? []);
      }
      default:
        return JSON.stringify({ error: `Unknown action: ${action}` });
    }
  } catch (err: any) {
    return safeExceptionError(err, "Slack");
  }
}
