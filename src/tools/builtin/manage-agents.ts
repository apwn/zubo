import { registerTool } from "../registry";
import {
  loadAgentDefinitions,
  getAgentDefinition,
  createAgentDefinition,
  removeAgentDefinition,
} from "../../agent/agents";

export function registerManageAgentsTool() {
  registerTool({
    definition: {
      name: "manage_agents",
      description:
        "Create, list, view, or remove sub-agents. Sub-agents have their own system prompt and scoped tools. Use the delegate tool to assign tasks to created agents.",
      input_schema: {
        type: "object",
        properties: {
          action: {
            type: "string",
            enum: ["create", "list", "view", "remove"],
            description: "The action to perform",
          },
          name: {
            type: "string",
            description:
              "Agent name (lowercase, underscores only). Required for create, view, and remove.",
          },
          description: {
            type: "string",
            description: "What this agent does. Required for create.",
          },
          system_prompt: {
            type: "string",
            description: "The agent's system prompt. Required for create.",
          },
          tools: {
            type: "array",
            items: { type: "string" },
            description:
              "List of tool names the agent can use (e.g., ['web_search', 'url_fetch', 'memory_write']). Required for create.",
          },
        },
        required: ["action"],
      },
    },
    execute: async (input) => {
      const { action, name, description, system_prompt, tools } = input as {
        action: string;
        name?: string;
        description?: string;
        system_prompt?: string;
        tools?: string[];
      };

      switch (action) {
        case "create": {
          if (!name || !/^[a-z0-9_]+$/.test(name)) {
            return JSON.stringify({
              error: "Invalid name. Must match [a-z0-9_]+",
            });
          }
          if (!description) {
            return JSON.stringify({ error: "description is required" });
          }
          if (!system_prompt) {
            return JSON.stringify({ error: "system_prompt is required" });
          }
          if (!tools || tools.length === 0) {
            return JSON.stringify({
              error: "tools array is required (at least one tool)",
            });
          }

          // Check if agent already exists
          if (getAgentDefinition(name)) {
            return JSON.stringify({
              error: `Agent "${name}" already exists. Remove it first to recreate.`,
            });
          }

          const agent = createAgentDefinition(
            name,
            description,
            system_prompt,
            tools
          );
          return JSON.stringify({
            success: true,
            name: agent.name,
            tools: agent.tools,
            message: `Agent "${name}" created. Use delegate to assign tasks to it.`,
          });
        }

        case "list": {
          const agents = loadAgentDefinitions();
          if (agents.length === 0) {
            return "No agents defined yet. Use manage_agents with action 'create' to create one.";
          }
          return JSON.stringify({
            agents: agents.map((a) => ({
              name: a.name,
              description: a.description,
              tools: a.tools,
            })),
            count: agents.length,
          });
        }

        case "view": {
          if (!name) {
            return JSON.stringify({ error: "name is required for view" });
          }
          const agent = getAgentDefinition(name);
          if (!agent) {
            return JSON.stringify({
              error: `Agent "${name}" not found.`,
            });
          }
          return JSON.stringify({
            name: agent.name,
            description: agent.description,
            system_prompt: agent.systemPrompt,
            tools: agent.tools,
          });
        }

        case "remove": {
          if (!name) {
            return JSON.stringify({ error: "name is required for remove" });
          }
          const removed = removeAgentDefinition(name);
          if (removed) {
            return JSON.stringify({
              success: true,
              message: `Agent "${name}" removed.`,
            });
          }
          return JSON.stringify({
            error: `Agent "${name}" not found.`,
          });
        }

        default:
          return JSON.stringify({ error: `Unknown action: ${action}` });
      }
    },
  });
}
