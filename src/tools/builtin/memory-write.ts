import { registerTool } from "../registry";
import { writeAndIndexMemory } from "../../memory/engine";
import { getDb } from "../../db/connection";

export function registerMemoryWriteTool() {
  registerTool({
    definition: {
      name: "memory_write",
      description:
        "Save an important fact or piece of information to persistent memory. Use this when the user shares personal details, preferences, or any information worth remembering across conversations.",
      input_schema: {
        type: "object",
        properties: {
          content: {
            type: "string",
            description:
              "The information to remember. Be specific and factual. Example: 'User's name is Thomas. He lives in Berlin.'",
          },
        },
        required: ["content"],
      },
    },
    execute: async (input) => {
      const content = input.content as string;
      const db = getDb();
      await writeAndIndexMemory(db, content);
      return `Saved to memory: "${content.slice(0, 100)}"`;
    },
  });
}
