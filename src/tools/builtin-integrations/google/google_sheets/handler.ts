const API = "https://sheets.googleapis.com/v4/spreadsheets";

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

  const { action, spreadsheet_id, title, range, values } = input as {
    action: string;
    spreadsheet_id?: string;
    title?: string;
    range?: string;
    values?: unknown[][];
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
          body: JSON.stringify({ properties: { title } }),
        });
        if (!res.ok) return safeApiErr(res.status, res.statusText, "Google Sheets");
        const sheet = (await res.json()) as any;
        return JSON.stringify({
          spreadsheet_id: sheet.spreadsheetId,
          title: sheet.properties?.title,
          url: sheet.spreadsheetUrl,
        });
      }

      case "read": {
        if (!spreadsheet_id) return JSON.stringify({ error: "spreadsheet_id is required for read" });
        if (!range) return JSON.stringify({ error: "range is required for read" });
        const encodedRange = encodeURIComponent(range);
        const res = await fetch(`${API}/${spreadsheet_id}/values/${encodedRange}`, { headers });
        if (!res.ok) return safeApiErr(res.status, res.statusText, "Google Sheets");
        const data = (await res.json()) as any;
        return JSON.stringify({ range: data.range, values: data.values || [] });
      }

      case "append": {
        if (!spreadsheet_id) return JSON.stringify({ error: "spreadsheet_id is required for append" });
        if (!range) return JSON.stringify({ error: "range is required for append" });
        if (!values) return JSON.stringify({ error: "values are required for append" });
        const encodedRange = encodeURIComponent(range);
        const res = await fetch(
          `${API}/${spreadsheet_id}/values/${encodedRange}:append?valueInputOption=USER_ENTERED`,
          {
            method: "POST",
            headers,
            body: JSON.stringify({ values }),
          }
        );
        if (!res.ok) return safeApiErr(res.status, res.statusText, "Google Sheets");
        const result = (await res.json()) as any;
        return JSON.stringify({
          updated_range: result.updates?.updatedRange,
          updated_rows: result.updates?.updatedRows,
        });
      }

      case "update": {
        if (!spreadsheet_id) return JSON.stringify({ error: "spreadsheet_id is required for update" });
        if (!range) return JSON.stringify({ error: "range is required for update" });
        if (!values) return JSON.stringify({ error: "values are required for update" });
        const encodedRange = encodeURIComponent(range);
        const res = await fetch(
          `${API}/${spreadsheet_id}/values/${encodedRange}?valueInputOption=USER_ENTERED`,
          {
            method: "PUT",
            headers,
            body: JSON.stringify({ values }),
          }
        );
        if (!res.ok) return safeApiErr(res.status, res.statusText, "Google Sheets");
        const result = (await res.json()) as any;
        return JSON.stringify({
          updated_range: result.updatedRange,
          updated_cells: result.updatedCells,
        });
      }

      default:
        return JSON.stringify({ error: `Unknown action: ${action}` });
    }
  } catch (err: any) {
    console.error(`[Google Sheets] Request failed: ${err.message}`);
    return JSON.stringify({ error: "Google Sheets request failed. Check logs for details." });
  }
}
