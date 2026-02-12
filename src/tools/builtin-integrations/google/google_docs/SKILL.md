# google_docs

Manage Google Docs: create, read, and update documents. Requires a Google API key stored as `google_api_key`.

## Input Schema

```json
{
  "type": "object",
  "properties": {
    "action": {
      "type": "string",
      "enum": ["create", "read", "update"],
      "description": "The action to perform"
    },
    "document_id": {
      "type": "string",
      "description": "The document ID (required for read, update)"
    },
    "title": {
      "type": "string",
      "description": "Document title (required for create)"
    },
    "text": {
      "type": "string",
      "description": "Text to insert (for update)"
    },
    "index": {
      "type": "number",
      "description": "Insert position index (for update, default: 1 = start)"
    }
  },
  "required": ["action"]
}
```
