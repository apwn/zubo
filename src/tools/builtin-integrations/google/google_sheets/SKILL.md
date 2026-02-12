# google_sheets

Manage Google Sheets: create, read, append rows, and update cells. Requires a Google API key stored as `google_api_key`.

## Input Schema

```json
{
  "type": "object",
  "properties": {
    "action": {
      "type": "string",
      "enum": ["create", "read", "append", "update"],
      "description": "The action to perform"
    },
    "spreadsheet_id": {
      "type": "string",
      "description": "The spreadsheet ID (required for read, append, update)"
    },
    "title": {
      "type": "string",
      "description": "Spreadsheet title (required for create)"
    },
    "range": {
      "type": "string",
      "description": "Cell range in A1 notation, e.g., 'Sheet1!A1:D10' (required for read, append, update)"
    },
    "values": {
      "type": "array",
      "items": { "type": "array", "items": {} },
      "description": "2D array of values to write (required for append and update)"
    }
  },
  "required": ["action"]
}
```
