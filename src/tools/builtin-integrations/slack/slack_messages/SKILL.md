# slack_messages

Send and read Slack messages, list channels, and search messages. Requires a Slack bot token stored as `slack_token`.

## Input Schema

```json
{
  "type": "object",
  "properties": {
    "action": {
      "type": "string",
      "enum": ["send", "read", "list_channels", "search"],
      "description": "Action to perform"
    },
    "channel": {
      "type": "string",
      "description": "Channel ID (for send and read)"
    },
    "text": {
      "type": "string",
      "description": "Message text (for send)"
    },
    "query": {
      "type": "string",
      "description": "Search query (for search)"
    },
    "limit": {
      "type": "number",
      "description": "Max results (default 20)"
    }
  },
  "required": ["action"]
}
```

## Usage Hints

- Use "list_channels" to see available channels.
- Use "send" with channel and text to post a message.
- Use "read" with channel to see recent messages.
- Use "search" with query to search message history.
