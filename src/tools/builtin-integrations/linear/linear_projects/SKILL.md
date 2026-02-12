# linear_projects

List and view Linear projects. Requires `linear_token`.

## Input Schema

```json
{
  "type": "object",
  "properties": {
    "action": { "type": "string", "enum": ["list", "get"], "description": "Action to perform" },
    "project_id": { "type": "string", "description": "Project ID (for get)" }
  },
  "required": ["action"]
}
```

## Usage Hints

- Use "list" to see all projects.
- Use "get" with project_id for details.
