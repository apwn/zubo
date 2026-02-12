# web_search

Search the web using DuckDuckGo and return relevant results.

## Input Schema

```json
{
  "type": "object",
  "properties": {
    "query": {
      "type": "string",
      "description": "The search query."
    },
    "maxResults": {
      "type": "number",
      "description": "Maximum number of results to return (default 5)."
    }
  },
  "required": ["query"]
}
```

## Usage Hints

Use this tool when the user asks you to search the web, look something up online, or find current information. Good for news, facts, documentation, and general knowledge queries.
