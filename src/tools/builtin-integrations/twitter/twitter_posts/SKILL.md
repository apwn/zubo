# twitter_posts

Post tweets, read timeline, search, and reply on Twitter/X. Requires `twitter_bearer_token` for reading. For posting also needs `twitter_api_key`, `twitter_api_secret`, `twitter_access_token`, `twitter_access_secret`.

## Input Schema

```json
{
  "type": "object",
  "properties": {
    "action": { "type": "string", "enum": ["post", "timeline", "search", "reply"], "description": "Action to perform" },
    "text": { "type": "string", "description": "Tweet text (for post and reply)" },
    "query": { "type": "string", "description": "Search query" },
    "tweet_id": { "type": "string", "description": "Tweet ID (for reply)" },
    "max_results": { "type": "number", "description": "Max results (default 10)" }
  },
  "required": ["action"]
}
```

## Usage Hints

- "post" and "reply" require OAuth credentials and user confirmation.
- "timeline" and "search" only need the bearer token.
