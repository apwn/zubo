# file_write

Write content to a file on the local filesystem.

## Input Schema

```json
{
  "type": "object",
  "properties": {
    "path": {
      "type": "string",
      "description": "Absolute or ~ path to the file to write."
    },
    "content": {
      "type": "string",
      "description": "The content to write to the file."
    },
    "append": {
      "type": "boolean",
      "description": "If true, append to file instead of overwriting (default false)."
    }
  },
  "required": ["path", "content"]
}
```

## Usage Hints

Use this tool when the user asks you to create, write, or save content to a file. Use ~ for home directory paths. Set append=true to add to existing files.
