import { Database } from "bun:sqlite";
import { registerTool } from "../registry";
import { searchMemoryAsync } from "../../memory/engine";

export function registerMemorySearchTool(db: Database) {
  registerTool({
    definition: {
      name: "memory_search",
      description:
        "Search persistent memory for previously stored information. Use this when the user asks about something you might have saved before, or when you need to recall facts about the user.",
      input_schema: {
        type: "object",
        properties: {
          query: {
            type: "string",
            description:
              "Search query. Use natural language — both keyword and semantic search are used.",
          },
        },
        required: ["query"],
      },
    },
    execute: async (input) => {
      const query = input.query as string;
      const results = await searchMemoryAsync(db, query, 5);

      if (results.length === 0) {
        return "No relevant memories found.";
      }

      const formatted = results
        .map((r, i) => `[${i + 1}] ${r.content}`)
        .join("\n\n");

      return `Found ${results.length} relevant memories:\n\n${formatted}`;
    },
  });
}
