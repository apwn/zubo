# jira_issues

Manage Jira issues: list, create, get, update, search, transition. Requires `jira_token`, `jira_email`, and `jira_url` secrets.

## Input Schema

```json
{
  "type": "object",
  "properties": {
    "action": { "type": "string", "enum": ["list", "create", "get", "update", "search", "transition"], "description": "Action to perform" },
    "issue_key": { "type": "string", "description": "Issue key e.g. PROJ-123" },
    "project_key": { "type": "string", "description": "Project key (for create, list)" },
    "summary": { "type": "string", "description": "Issue summary" },
    "description": { "type": "string", "description": "Issue description" },
    "issue_type": { "type": "string", "description": "Issue type (Bug, Task, Story)" },
    "jql": { "type": "string", "description": "JQL query (for search)" },
    "transition_id": { "type": "string", "description": "Transition ID (for transition)" }
  },
  "required": ["action"]
}
```

## Usage Hints

- Use "search" with JQL for flexible queries.
- Use "list" with project_key for recent issues.
- Use "transition" to move issues through workflow stages.
