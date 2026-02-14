# claude_code_task

Delegate a task to Claude Code CLI for autonomous code generation, file editing, and development workflows.

## Input Schema

```json
{
  "type": "object",
  "properties": {
    "task": {
      "type": "string",
      "description": "The task description to send to Claude Code"
    },
    "workdir": {
      "type": "string",
      "description": "Working directory for Claude Code to operate in"
    },
    "model": {
      "type": "string",
      "description": "Specific model to use (e.g., \"claude-sonnet-4-5-20250929\")"
    },
    "allowedTools": {
      "type": "array",
      "items": { "type": "string" },
      "description": "List of tools Claude Code is allowed to use"
    }
  },
  "required": ["task"]
}
```

## Usage Hints

- Use this to delegate complex coding tasks like bug fixes, refactoring, and test writing
- Set `workdir` to the project root so Claude Code has the right context
- The task runs with a 5-minute timeout
- Output is automatically parsed from Claude Code's JSON format
