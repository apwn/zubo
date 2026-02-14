# code_interpreter

Execute Python, JavaScript, or TypeScript code in a sandboxed subprocess and return the output. Use this to run calculations, data processing, text manipulation, or any code the user requests.

## Input Schema

```json
{
  "type": "object",
  "properties": {
    "code": {
      "type": "string",
      "description": "The code to execute"
    },
    "language": {
      "type": "string",
      "enum": ["python", "javascript", "typescript"],
      "description": "Programming language to use"
    }
  },
  "required": ["code", "language"]
}
```

## Usage Hints

- Use "javascript" or "typescript" for JS/TS code (runs via Bun).
- Use "python" for Python code (requires python3 installed).
- Code runs in an isolated subprocess with a timeout.
- stdout and stderr are captured and returned.
- Large outputs are truncated.
