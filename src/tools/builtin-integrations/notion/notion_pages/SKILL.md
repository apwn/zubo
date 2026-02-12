# notion_pages

Manage Notion pages: create, read, and update pages. Requires a Notion integration token stored as `notion_token`.

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
    "page_id": {
      "type": "string",
      "description": "Page ID (required for read and update)"
    },
    "parent_page_id": {
      "type": "string",
      "description": "Parent page ID (required for create)"
    },
    "parent_database_id": {
      "type": "string",
      "description": "Parent database ID (alternative to parent_page_id for create)"
    },
    "title": {
      "type": "string",
      "description": "Page title (required for create)"
    },
    "content": {
      "type": "string",
      "description": "Page content as plain text (for create and update)"
    },
    "properties": {
      "type": "object",
      "description": "Properties to set (for create in database, or update)"
    }
  },
  "required": ["action"]
}
```
