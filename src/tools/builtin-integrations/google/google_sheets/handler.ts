import { safeApiError, safeExceptionError } from "../../api-helpers.js";
import { getGoogleAccessToken } from "../../../../util/google-tokens";

const API = "https://sheets.googleapis.com/v4/spreadsheets";

export default async function (input: Record<string, unknown>): Promise<string> {
  let token: string;
  try {
    token = await getGoogleAccessToken();
  } catch (err: any) {
    return JSON.stringify({ error: err.message });
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
        if (!res.ok) return await safeApiError(res, "Google");
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
        if (!res.ok) return await safeApiError(res, "Google");
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
        if (!res.ok) return await safeApiError(res, "Google");
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
        if (!res.ok) return await safeApiError(res, "Google");
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
    return safeExceptionError(err, "Google");
  }
}
