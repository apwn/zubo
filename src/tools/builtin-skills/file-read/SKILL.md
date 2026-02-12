# file_read

Read the contents of a file from the local filesystem.

## Input Schema

```json
{
  "type": "object",
  "properties": {
    "path": {
      "type": "string",
      "description": "Absolute or ~ path to the file to read."
    },
    "maxLength": {
      "type": "number",
      "description": "Maximum characters to return (default 50000)."
    }
  },
  "required": ["path"]
}
```

## Usage Hints

Use this tool when the user asks you to read, view, or check the contents of a file on their machine. Supports text files. Use ~ for home directory paths.
