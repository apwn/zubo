# google_drive

Manage Google Drive: list files, create folders, and get file info. Requires a Google API key stored as `google_api_key`.

## Input Schema

```json
{
  "type": "object",
  "properties": {
    "action": {
      "type": "string",
      "enum": ["list", "create_folder", "get"],
      "description": "The action to perform"
    },
    "file_id": {
      "type": "string",
      "description": "File or folder ID (required for get)"
    },
    "name": {
      "type": "string",
      "description": "Folder name (required for create_folder)"
    },
    "parent_id": {
      "type": "string",
      "description": "Parent folder ID (optional for create_folder)"
    },
    "query": {
      "type": "string",
      "description": "Search query (for list, uses Google Drive query syntax)"
    },
    "page_size": {
      "type": "number",
      "description": "Number of results (for list, default: 20)"
    }
  },
  "required": ["action"]
}
```
