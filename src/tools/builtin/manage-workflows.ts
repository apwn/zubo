import { registerTool } from "../registry";
import {
  loadWorkflowDefinitions,
  getWorkflowDefinition,
  createWorkflowDefinition,
  removeWorkflowDefinition,
  type WorkflowDefinition,
  type WorkflowStep,
} from "../../agent/workflow";

export function registerManageWorkflowsTool() {
  registerTool({
    definition: {
      name: "manage_workflows",
      description:
        "Create, list, view, and remove multi-agent workflows. Workflows orchestrate multiple agents in a dependency graph.",
      input_schema: {
        type: "object",
        properties: {
          action: {
            type: "string",
            enum: ["create", "list", "view", "remove"],
            description: "Action to perform",
          },
          name: {
            type: "string",
            description: "Workflow name",
          },
          description: {
            type: "string",
            description: "Workflow description (for create)",
          },
          agents: {
            type: "array",
            items: { type: "string" },
            description: "Agent names used in this workflow (for create)",
          },
          steps: {
            type: "array",
            items: {
              type: "object",
              properties: {
                name: { type: "string" },
                agent: { type: "string" },
                task: { type: "string" },
                dependsOn: { type: "array", items: { type: "string" } },
                outputVar: { type: "string" },
              },
            },
            description: "Workflow steps (for create)",
          },
        },
        required: ["action"],
      },
    },
    async execute(input) {
      const action = input.action as string;

      switch (action) {
        case "list": {
          const workflows = loadWorkflowDefinitions();
          if (workflows.length === 0) return "No workflows defined.";
          return JSON.stringify(
            workflows.map((w) => ({
              name: w.name,
              description: w.description,
              stepCount: w.steps.length,
              agents: w.agents,
            }))
          );
        }

        case "view": {
          const name = input.name as string;
          if (!name) return JSON.stringify({ error: "name is required" });
          const def = getWorkflowDefinition(name);
          if (!def) return JSON.stringify({ error: `Workflow "${name}" not found` });
          return JSON.stringify(def);
        }

        case "create": {
          const name = input.name as string;
          const description = (input.description as string) ?? "";
          const agents = (input.agents as string[]) ?? [];
          const steps = (input.steps as WorkflowStep[]) ?? [];

          if (!name) return JSON.stringify({ error: "name is required" });
          if (!steps.length) return JSON.stringify({ error: "at least one step is required" });

          const def: WorkflowDefinition = {
            name,
            description,
            agents,
            steps: steps.map((s) => ({
              name: s.name ?? "unnamed",
              agent: s.agent ?? "main",
              task: s.task ?? "",
              dependsOn: s.dependsOn ?? [],
              outputVar: s.outputVar,
            })),
          };

          const path = createWorkflowDefinition(def);
          return JSON.stringify({ created: true, name, path });
        }

        case "remove": {
          const name = input.name as string;
          if (!name) return JSON.stringify({ error: "name is required" });
          const removed = removeWorkflowDefinition(name);
          return JSON.stringify({ removed, name });
        }

        default:
          return JSON.stringify({ error: `Unknown action: ${action}` });
      }
    },
  });
}
