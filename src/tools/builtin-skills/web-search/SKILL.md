# web_search

Search the web and return relevant results. Uses Brave Search API when a `BRAVE_API_KEY` is configured in `~/.zubo/secrets.json`, otherwise falls back to DuckDuckGo HTML scraping.

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

## Configuration

To use Brave Search (recommended), add your API key to `~/.zubo/secrets.json`:

```json
{
  "BRAVE_API_KEY": "your-brave-api-key"
}
```

If no Brave API key is found, or if the Brave API call fails, the skill automatically falls back to DuckDuckGo.

## Usage Hints

Use this tool when the user asks you to search the web, look something up online, or find current information. Good for news, facts, documentation, and general knowledge queries.
