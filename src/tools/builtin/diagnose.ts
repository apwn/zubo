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

      const parts: string[] = [];

      // Check for failed MCP servers
      try {
        const { getFailedMcpServers } = await import("../mcp-client");
        const failed = getFailedMcpServers();
        if (failed.length > 0) {
          parts.push(`MCP servers failed to start (${failed.length}):\n${failed.map(f => `  - ${f.name}: ${f.error}`).join("\n")}`);
        }
      } catch {}

      if (filtered.length === 0 && parts.length === 0) {
        return "No recent errors found. System appears healthy.";
      }

      if (filtered.length > 0) {
        const summary = filtered
          .map((e) => `[${e.timestamp}] ${e.source}: ${e.message}`)
          .join("\n");
        parts.push(`Recent errors (${filtered.length}):\n${summary}`);
      }

      return parts.join("\n\n");
    },
  });
}
