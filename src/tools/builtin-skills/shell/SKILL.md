# shell

Execute a shell command and return its output.

## Input Schema

```json
{
  "type": "object",
  "properties": {
    "command": {
      "type": "string",
      "description": "The shell command to execute."
    },
    "timeout": {
      "type": "number",
      "description": "Timeout in milliseconds (default 30000)."
    }
  },
  "required": ["command"]
}
```

## Usage Hints

Use this tool when the user asks you to run a command, check system info, list files, or perform any shell operation. Be cautious with destructive commands.
