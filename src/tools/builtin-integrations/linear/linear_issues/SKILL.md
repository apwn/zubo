# linear_issues

Manage Linear issues: list, create, get, update, search. Requires `linear_token`.

## Input Schema

```json
{
  "type": "object",
  "properties": {
    "action": { "type": "string", "enum": ["list", "create", "get", "update", "search"], "description": "Action to perform" },
    "issue_id": { "type": "string", "description": "Issue ID (for get, update)" },
    "title": { "type": "string", "description": "Issue title (for create)" },
    "description": { "type": "string", "description": "Issue description" },
    "team_id": { "type": "string", "description": "Team ID (for create, list)" },
    "state": { "type": "string", "description": "State name filter" },
    "query": { "type": "string", "description": "Search query" },
    "assignee_id": { "type": "string", "description": "Assignee ID" },
    "priority": { "type": "number", "description": "Priority (0=none, 1=urgent, 2=high, 3=medium, 4=low)" }
  },
  "required": ["action"]
}
```

## Usage Hints

- Linear uses GraphQL. This tool wraps common operations.
- Use "list" with optional team_id to see issues.
- Use "create" with title and team_id.
- Use "search" with a text query.
