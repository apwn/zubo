import { safeApiError, safeExceptionError } from "../../api-helpers.js";

const API = "https://www.googleapis.com/calendar/v3";

export default async function (input: Record<string, unknown>): Promise<string> {
  const token = (globalThis as any).Zubo?.getSecret?.("google_calendar_token");
  if (!token) {
    return JSON.stringify({ error: "Google Calendar token not configured. Use secret_set to store 'google_calendar_token'." });
  }

  const { action, event_id, summary, description, start, end, time_min, time_max, calendar_id } = input as {
    action: string; event_id?: string; summary?: string; description?: string;
    start?: string; end?: string; time_min?: string; time_max?: string; calendar_id?: string;
  };

  const calId = calendar_id || "primary";
  const headers: Record<string, string> = {
    Authorization: `Bearer ${token}`,
    "Content-Type": "application/json",
  };

  try {
    switch (action) {
      case "list": {
        const now = new Date();
        const tMin = time_min || now.toISOString();
        const tMax = time_max || new Date(now.getTime() + 7 * 86400_000).toISOString();
        const qs = `timeMin=${encodeURIComponent(tMin)}&timeMax=${encodeURIComponent(tMax)}&singleEvents=true&orderBy=startTime&maxResults=20`;
        const res = await fetch(`${API}/calendars/${calId}/events?${qs}`, { headers });
        if (!res.ok) return await safeApiError(res, "Google Calendar");
        const data = (await res.json()) as any;
        return JSON.stringify(data.items?.map((e: any) => ({
          id: e.id, summary: e.summary, start: e.start?.dateTime || e.start?.date,
          end: e.end?.dateTime || e.end?.date, status: e.status,
        })) ?? []);
      }
      case "create": {
        if (!summary) return JSON.stringify({ error: "summary required" });
        if (!start || !end) return JSON.stringify({ error: "start and end required" });
        const res = await fetch(`${API}/calendars/${calId}/events`, {
          method: "POST", headers,
          body: JSON.stringify({
            summary, description: description || "",
            start: { dateTime: start }, end: { dateTime: end },
          }),
        });
        if (!res.ok) return await safeApiError(res, "Google Calendar");
        const data = (await res.json()) as any;
        return JSON.stringify({ created: true, id: data.id, summary: data.summary, htmlLink: data.htmlLink });
      }
      case "get": {
        if (!event_id) return JSON.stringify({ error: "event_id required" });
        const res = await fetch(`${API}/calendars/${calId}/events/${event_id}`, { headers });
        if (!res.ok) return await safeApiError(res, "Google Calendar");
        const e = (await res.json()) as any;
        return JSON.stringify({
          id: e.id, summary: e.summary, description: e.description,
          start: e.start?.dateTime || e.start?.date, end: e.end?.dateTime || e.end?.date,
          status: e.status, attendees: e.attendees?.map((a: any) => a.email),
        });
      }
      case "update": {
        if (!event_id) return JSON.stringify({ error: "event_id required" });
        const patch: any = {};
        if (summary) patch.summary = summary;
        if (description) patch.description = description;
        if (start) patch.start = { dateTime: start };
        if (end) patch.end = { dateTime: end };
        const res = await fetch(`${API}/calendars/${calId}/events/${event_id}`, {
          method: "PATCH", headers,
          body: JSON.stringify(patch),
        });
        if (!res.ok) return await safeApiError(res, "Google Calendar");
        const data = (await res.json()) as any;
        return JSON.stringify({ updated: true, id: data.id, summary: data.summary });
      }
      case "delete": {
        if (!event_id) return JSON.stringify({ error: "event_id required" });
        const res = await fetch(`${API}/calendars/${calId}/events/${event_id}`, { method: "DELETE", headers });
        if (!res.ok) return await safeApiError(res, "Google Calendar");
        return JSON.stringify({ deleted: true });
      }
      default:
        return JSON.stringify({ error: `Unknown action: ${action}` });
    }
  } catch (err: any) {
    return safeExceptionError(err, "Google Calendar");
  }
}
