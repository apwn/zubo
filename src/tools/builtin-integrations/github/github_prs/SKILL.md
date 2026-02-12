# github_prs

Manage GitHub pull requests: list, create, get details, and review. Requires a GitHub personal access token stored as `github_token`.

## Input Schema

```json
{
  "type": "object",
  "properties": {
    "action": {
      "type": "string",
      "enum": ["list", "create", "get", "review"],
      "description": "The action to perform"
    },
    "owner": {
      "type": "string",
      "description": "Repository owner (user or org)"
    },
    "repo": {
      "type": "string",
      "description": "Repository name"
    },
    "pr_number": {
      "type": "number",
      "description": "PR number (required for get and review)"
    },
    "title": {
      "type": "string",
      "description": "PR title (required for create)"
    },
    "body": {
      "type": "string",
      "description": "PR body or review comment"
    },
    "head": {
      "type": "string",
      "description": "Head branch (required for create)"
    },
    "base": {
      "type": "string",
      "description": "Base branch (required for create, default: main)"
    },
    "event": {
      "type": "string",
      "enum": ["APPROVE", "REQUEST_CHANGES", "COMMENT"],
      "description": "Review event type (for review, default: COMMENT)"
    },
    "state": {
      "type": "string",
      "enum": ["open", "closed", "all"],
      "description": "Filter by state (for list, default: open)"
    }
  },
  "required": ["action", "owner", "repo"]
}
```
