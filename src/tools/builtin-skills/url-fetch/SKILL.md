# url_fetch

Fetch the content of a URL and return the text body.

## Input Schema

```json
{
  "type": "object",
  "properties": {
    "url": {
      "type": "string",
      "description": "The URL to fetch."
    },
    "maxLength": {
      "type": "number",
      "description": "Maximum characters to return (default 10000)."
    }
  },
  "required": ["url"]
}
```

## Usage Hints

Use this tool when the user asks you to read, fetch, or summarize a web page. Returns raw text content — useful for reading articles, docs, or API responses.
