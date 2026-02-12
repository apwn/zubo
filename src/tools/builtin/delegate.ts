import { registerTool } from "../registry";
import type { LlmProvider } from "../../llm/provider";

export function registerDelegateTool(llm: LlmProvider) {
  registerTool({
    definition: {
      name: "delegate",
      description:
        "Delegate a task to a named sub-agent. The sub-agent runs with its own system prompt and scoped tools, shares memory, but keeps separate conversation history. Use manage_agents to create agents first.",
      input_schema: {
        type: "object",
        properties: {
          agent: {
            type: "string",
            description: "The name of the agent to delegate to",
          },
          task: {
            type: "string",
            description:
              "The task to delegate, as a natural language instruction",
          },
        },
        required: ["agent", "task"],
      },
    },
    execute: async (input) => {
      const { agent, task } = input as { agent: string; task: string };

      if (!agent) {
        return JSON.stringify({ error: "agent name is required" });
      }
      if (!task) {
        return JSON.stringify({ error: "task is required" });
      }

      // Dynamic import to avoid circular dependency
      const { delegateToAgent } = await import("../../agent/delegate");
      const result = await delegateToAgent(llm, agent, task);
      return result;
    },
  });
}
