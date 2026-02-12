# google_calendar

Manage Google Calendar events: list, create, get, update, delete. Requires a Google Calendar token stored as `google_calendar_token`.

## Input Schema

```json
{
  "type": "object",
  "properties": {
    "action": {
      "type": "string",
      "enum": ["list", "create", "get", "update", "delete"],
      "description": "Action to perform"
    },
    "event_id": { "type": "string", "description": "Event ID (for get, update, delete)" },
    "summary": { "type": "string", "description": "Event title" },
    "description": { "type": "string", "description": "Event description" },
    "start": { "type": "string", "description": "Start datetime (ISO 8601)" },
    "end": { "type": "string", "description": "End datetime (ISO 8601)" },
    "time_min": { "type": "string", "description": "Filter start (ISO 8601, for list)" },
    "time_max": { "type": "string", "description": "Filter end (ISO 8601, for list)" },
    "calendar_id": { "type": "string", "description": "Calendar ID (default: primary)" }
  },
  "required": ["action"]
}
```

## Usage Hints

- Use "list" to see upcoming events. Defaults to next 7 days.
- Use "create" with summary, start, and end to create an event.
- Use "get" with event_id to see event details.
- Use "update" with event_id and fields to modify.
- Use "delete" with event_id to remove an event.
