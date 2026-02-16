# code_interpreter

Execute Python, JavaScript, or TypeScript code in a persistent sandboxed workspace and return the output. Use this to run calculations, data processing, text manipulation, chart generation, or any code the user requests.

Code runs inside `~/.zubo/workspace/code-interpreter/` and files are **not** deleted after execution, so scripts can reference outputs from previous runs.

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
    },
    "packages": {
      "type": "array",
      "items": { "type": "string" },
      "description": "Optional list of packages to install before execution. For Python these are installed via pip; for JS/TS via bun add."
    }
  },
  "required": ["code", "language"]
}
```

## Output Schema

The tool returns a JSON string with the following fields:

| Field           | Type     | Description                                                                 |
|-----------------|----------|-----------------------------------------------------------------------------|
| `exitCode`      | number   | Process exit code (0 = success).                                            |
| `timedOut`      | boolean  | Whether the execution was killed after the 30 s timeout.                    |
| `executionTime` | number   | Wall-clock milliseconds the execution took.                                 |
| `stdout`        | string   | Captured standard output (truncated at 50 000 chars).                       |
| `stderr`        | string   | Captured standard error (truncated at 10 000 chars).                        |
| `files`         | string[] | Absolute paths to any **new** image files (png, jpg, svg, gif, webp) created during execution. |
| `installLog`    | string   | *(Only present when `packages` was provided)* Output from the package install step. |

## Usage Hints

- Use `"javascript"` or `"typescript"` for JS/TS code (runs via Bun).
- Use `"python"` for Python code (requires python3 installed).
- Code runs in a persistent workspace (`~/.zubo/workspace/code-interpreter/`), so files written by one execution are available in subsequent executions.
- The working directory is set to the workspace, so relative file paths work naturally (e.g., `open("data.csv")` or `savefig("chart.png")`).
- To install packages, pass them in the `packages` array:
  - Python example: `"packages": ["pandas", "matplotlib"]`
  - JS/TS example: `"packages": ["lodash", "chart.js"]`
- When your code saves charts or images, the `files` array in the response will contain the absolute paths to the newly created files.
- stdout and stderr are captured and returned; large outputs are truncated.
- Dangerous system commands (rm -rf /, shutdown, etc.) are blocked.
- Package install has a 60 s timeout; code execution has a 30 s timeout.
