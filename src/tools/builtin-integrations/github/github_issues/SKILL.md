# github_issues

Manage GitHub issues: list, create, get details, and add comments. Requires a GitHub personal access token stored as `github_token`.

## Input Schema

```json
{
  "type": "object",
  "properties": {
    "action": {
      "type": "string",
      "enum": ["list", "create", "get", "comment"],
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
    "issue_number": {
      "type": "number",
      "description": "Issue number (required for get and comment)"
    },
    "title": {
      "type": "string",
      "description": "Issue title (required for create)"
    },
    "body": {
      "type": "string",
      "description": "Issue body or comment text"
    },
    "labels": {
      "type": "array",
      "items": { "type": "string" },
      "description": "Labels to apply (for create)"
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

## Usage Hints

- Use action "list" to see open issues for a repo.
- Use action "create" with title and body to open a new issue.
- Use action "get" with issue_number to see issue details.
- Use action "comment" with issue_number and body to add a comment.
