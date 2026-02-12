# notion_search

Search across your Notion workspace for pages and databases. Requires a Notion integration token stored as `notion_token`.

## Input Schema

```json
{
  "type": "object",
  "properties": {
    "query": {
      "type": "string",
      "description": "Search query text"
    },
    "filter_type": {
      "type": "string",
      "enum": ["page", "database"],
      "description": "Filter results by object type"
    },
    "page_size": {
      "type": "number",
      "description": "Number of results (default: 20)"
    }
  },
  "required": ["query"]
}
```
