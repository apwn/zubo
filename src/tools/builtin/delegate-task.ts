import { registerTool } from "../registry";
import type { LlmProvider } from "../../llm/provider";
import { logger } from "../../util/logger";

export function registerDelegateTaskTool(llm: LlmProvider): void {
  registerTool({
    definition: {
      name: "delegate_task",
      description:
        "Delegate a subtask to an ad-hoc sub-agent. The sub-agent runs a fresh agent loop with its own context. Use for complex tasks that benefit from focused, independent processing. Unlike 'delegate', this does not require a pre-registered agent.",
      input_schema: {
        type: "object",
        properties: {
          task: {
            type: "string",
            description: "Clear description of the subtask to delegate",
          },
          context: {
            type: "string",
            description:
              "Optional additional context or constraints for the sub-agent",
          },
        },
        required: ["task"],
      },
    },
    execute: async (input) => {
      const task = input.task as string;
      const context = input.context as string | undefined;

      if (!task) {
        return JSON.stringify({ error: "task is required" });
      }

      // Dynamic imports to avoid circular dependencies
      const { agentLoop } = await import("../../agent/loop");
      const crypto = await import("crypto");

      const subSessionId = "delegate-task-" + crypto.randomUUID().slice(0, 8);

      const message = context
        ? `${task}\n\nAdditional context: ${context}`
        : task;

      logger.info("Delegating subtask to ad-hoc sub-agent", {
        task: task.slice(0, 100),
        sessionId: subSessionId,
      });

      try {
        // Exclude delegation tools to prevent recursive delegation
        const { getAllToolDefs } = await import("../registry");
        const allowedTools = getAllToolDefs()
          .map((t) => t.name)
          .filter((n) => n !== "delegate_task" && n !== "delegate");

        const result = await agentLoop(llm, subSessionId, message, {
          systemPromptOverride:
            "You are a focused sub-agent. Complete the given task concisely and return the result. Do not ask follow-up questions.",
          maxRounds: 5,
          allowedTools,
        });

        logger.info("Sub-agent completed", {
          sessionId: subSessionId,
          toolCalls: result.toolCalls,
        });

        return result.reply;
      } catch (err: unknown) {
        const errorMessage =
          err instanceof Error ? err.message : String(err);
        logger.error("Sub-agent failed", {
          error: errorMessage,
          sessionId: subSessionId,
        });
        return "Delegation failed: " + errorMessage;
      }
    },
  });
}
