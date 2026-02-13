import { registerTool } from "../registry";
import { getRecentErrors } from "../../util/error-buffer";

export function registerDiagnoseTool(): void {
  registerTool({
    definition: {
      name: "diagnose",
      description:
        "Check recent errors and system health. Use when something seems wrong or the user reports an issue.",
      input_schema: {
        type: "object",
        properties: {
          category: {
            type: "string",
            description:
              "Optional error category filter (e.g. 'agent-loop', 'tool:shell')",
          },
        },
        required: [],
      },
    },
    execute: async (input) => {
      const category = input.category as string | undefined;
      const errors = getRecentErrors();

      const filtered = category
        ? errors.filter((e) => e.source.includes(category))
        : errors;

      if (filtered.length === 0) {
        return "No recent errors found. System appears healthy.";
      }

      const summary = filtered
        .map((e) => `[${e.timestamp}] ${e.source}: ${e.message}`)
        .join("\n");

      return `Found ${filtered.length} recent error(s):\n${summary}`;
    },
  });
}
