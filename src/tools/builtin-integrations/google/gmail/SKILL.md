# gmail

Manage Gmail: list, read, send, search, and reply to emails. Requires a Google API token stored as `gmail_token`.

## Input Schema

```json
{
  "type": "object",
  "properties": {
    "action": {
      "type": "string",
      "enum": ["list", "read", "send", "search", "reply"],
      "description": "Action to perform"
    },
    "message_id": {
      "type": "string",
      "description": "Message ID (for read and reply)"
    },
    "to": {
      "type": "string",
      "description": "Recipient email (for send)"
    },
    "subject": {
      "type": "string",
      "description": "Email subject (for send)"
    },
    "body": {
      "type": "string",
      "description": "Email body (for send and reply)"
    },
    "query": {
      "type": "string",
      "description": "Search query (for search)"
    },
    "max_results": {
      "type": "number",
      "description": "Max results (default 10)"
    }
  },
  "required": ["action"]
}
```

## Usage Hints

- Use "list" to see recent emails.
- Use "read" with message_id to view full email content.
- Use "send" with to, subject, and body to send an email.
- Use "search" with Gmail search query syntax.
- Use "reply" with message_id and body to reply.
