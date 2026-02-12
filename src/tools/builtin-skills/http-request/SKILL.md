# http_request

Make an HTTP request to any URL with full control over method, headers, and body.

## Input Schema

```json
{
  "type": "object",
  "properties": {
    "url": {
      "type": "string",
      "description": "The URL to send the request to."
    },
    "method": {
      "type": "string",
      "description": "HTTP method (GET, POST, PUT, DELETE, PATCH). Default GET."
    },
    "headers": {
      "type": "object",
      "description": "Key-value pairs for request headers."
    },
    "body": {
      "type": "string",
      "description": "Request body (for POST, PUT, PATCH)."
    }
  },
  "required": ["url"]
}
```

## Usage Hints

Use this tool when the user needs to call an API, make HTTP requests, or interact with web services. More flexible than url_fetch — supports all methods and custom headers.
