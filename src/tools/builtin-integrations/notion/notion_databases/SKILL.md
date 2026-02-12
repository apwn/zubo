# notion_databases

Query and create entries in Notion databases. Requires a Notion integration token stored as `notion_token`.

## Input Schema

```json
{
  "type": "object",
  "properties": {
    "action": {
      "type": "string",
      "enum": ["query", "create_entry"],
      "description": "The action to perform"
    },
    "database_id": {
      "type": "string",
      "description": "The database ID"
    },
    "filter": {
      "type": "object",
      "description": "Notion filter object (for query)"
    },
    "sorts": {
      "type": "array",
      "description": "Sort criteria (for query)"
    },
    "properties": {
      "type": "object",
      "description": "Properties for the new entry (for create_entry)"
    },
    "page_size": {
      "type": "number",
      "description": "Number of results (for query, default: 20)"
    }
  },
  "required": ["action", "database_id"]
}
```
