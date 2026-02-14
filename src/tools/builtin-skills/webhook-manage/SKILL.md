# webhook_manage

Manage webhook endpoints that let external services (GitHub, Stripe, CI/CD, etc.) send events to Zubo. Create, list, delete, and toggle webhooks.

## Input Schema

```json
{
  "type": "object",
  "properties": {
    "action": {
      "type": "string",
      "enum": ["create", "list", "delete", "toggle"],
      "description": "Action to perform"
    },
    "name": {
      "type": "string",
      "description": "Webhook name (for create, delete, toggle). Must be alphanumeric with hyphens/underscores."
    },
    "description": {
      "type": "string",
      "description": "Human-readable description of what this webhook receives (for create)"
    },
    "secret": {
      "type": "string",
      "description": "HMAC secret for signature verification (for create). Optional."
    }
  },
  "required": ["action"]
}
```

## Usage Hints

- Use "create" to set up a new webhook and get the URL to share.
- Use "list" to see all configured webhooks.
- Use "delete" to remove a webhook.
- Use "toggle" to enable/disable a webhook without deleting it.
- Webhook URL format: http://localhost:{port}/api/webhook/{id}
- Optional HMAC secret verifies X-Hub-Signature-256 header.
