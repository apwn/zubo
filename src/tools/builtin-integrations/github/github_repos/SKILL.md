# github_repos

List and get information about GitHub repositories. Requires a GitHub personal access token stored as `github_token`.

## Input Schema

```json
{
  "type": "object",
  "properties": {
    "action": {
      "type": "string",
      "enum": ["list", "get"],
      "description": "The action to perform"
    },
    "owner": {
      "type": "string",
      "description": "Repository owner or user whose repos to list"
    },
    "repo": {
      "type": "string",
      "description": "Repository name (required for get)"
    },
    "type": {
      "type": "string",
      "enum": ["all", "owner", "member"],
      "description": "Filter repos by type (for list, default: owner)"
    },
    "sort": {
      "type": "string",
      "enum": ["created", "updated", "pushed", "full_name"],
      "description": "Sort field (for list, default: updated)"
    }
  },
  "required": ["action"]
}
```
