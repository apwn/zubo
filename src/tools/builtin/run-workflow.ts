import { registerTool } from "../registry";
import type { LlmProvider } from "../../llm/provider";
import { executeWorkflow } from "../../agent/workflow-executor";

export function registerRunWorkflowTool(llm: LlmProvider) {
  registerTool({
    definition: {
      name: "run_workflow",
      description:
        "Execute a multi-agent workflow by name. Provide the workflow name and an input string. Steps execute respecting dependencies.",
      input_schema: {
        type: "object",
        properties: {
          workflow: {
            type: "string",
            description: "Name of the workflow to execute",
          },
          input: {
            type: "string",
            description: "Input text for the workflow (available as $input in step tasks)",
          },
        },
        required: ["workflow", "input"],
      },
    },
    async execute(input) {
      const workflowName = input.workflow as string;
      const workflowInput = input.input as string;

      if (!workflowName) return JSON.stringify({ error: "workflow name is required" });

      const result = await executeWorkflow(llm, workflowName, workflowInput);
      return JSON.stringify(result);
    },
  });
}
