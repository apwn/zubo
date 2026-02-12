# jira_boards

List Jira boards and sprints. Requires `jira_token`, `jira_email`, and `jira_url` secrets.

## Input Schema

```json
{
  "type": "object",
  "properties": {
    "action": { "type": "string", "enum": ["list_boards", "list_sprints"], "description": "Action to perform" },
    "board_id": { "type": "number", "description": "Board ID (for list_sprints)" }
  },
  "required": ["action"]
}
```

## Usage Hints

- Use "list_boards" to see all boards.
- Use "list_sprints" with board_id to see sprints.
