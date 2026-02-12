import type { LlmProvider, LlmMessage, LlmContentBlock } from "../llm/provider";
import { getAllToolDefs } from "../tools/registry";
import { executeTool } from "../tools/executor";
import { appendMessage } from "./session";
import { assembleContext } from "./context";
import { compactMessages } from "./compaction";
import { logger } from "../util/logger";

const MAX_TOOL_ROUNDS = 10;

export interface LoopResult {
  reply: string;
  toolCalls: number;
}

export async function agentLoop(
  llm: LlmProvider,
  sessionId: string,
  userMessage: string,
  memories: string = ""
): Promise<LoopResult> {
  // Persist user message
  appendMessage(sessionId, {
    role: "user",
    content: [{ type: "text", text: userMessage }],
    timestamp: new Date().toISOString(),
  });

  // Assemble context
  const ctx = assembleContext(sessionId, 50, memories);
  let messages = compactMessages(ctx.messages);
  const tools = getAllToolDefs();

  let totalToolCalls = 0;

  for (let round = 0; round < MAX_TOOL_ROUNDS; round++) {
    const response = await llm.chat({
      system: ctx.system,
      messages,
      tools: tools.length > 0 ? tools : undefined,
      maxTokens: 4096,
    });

    logger.debug("Claude response", {
      stopReason: response.stopReason,
      blocks: response.content.length,
    });

    // Extract text and tool_use blocks
    const textBlocks = response.content.filter(
      (b): b is LlmContentBlock & { type: "text"; text: string } =>
        b.type === "text"
    );
    const toolUseBlocks = response.content.filter(
      (b): b is LlmContentBlock & {
        type: "tool_use";
        id: string;
        name: string;
        input: Record<string, unknown>;
      } => b.type === "tool_use"
    );

    // If no tool calls, we're done
    if (toolUseBlocks.length === 0) {
      const reply = textBlocks.map((b) => b.text).join("\n") || "";

      appendMessage(sessionId, {
        role: "assistant",
        content: [{ type: "text", text: reply }],
        timestamp: new Date().toISOString(),
      });

      return { reply, toolCalls: totalToolCalls };
    }

    // There are tool calls — persist assistant response with full content blocks
    appendMessage(sessionId, {
      role: "assistant",
      content: response.content,
      timestamp: new Date().toISOString(),
    });
    messages.push({ role: "assistant", content: response.content });

    // Execute tools
    const toolResults: LlmContentBlock[] = [];
    for (const block of toolUseBlocks) {
      totalToolCalls++;
      const result = await executeTool(block.name, block.id, block.input);
      toolResults.push({
        type: "tool_result",
        tool_use_id: result.tool_use_id,
        content: result.content,
        is_error: result.is_error,
      });
    }

    // Add tool results as user message
    appendMessage(sessionId, {
      role: "user",
      content: toolResults,
      timestamp: new Date().toISOString(),
    });
    messages.push({ role: "user", content: toolResults });
  }

  // Safety: if we hit max rounds
  const fallback = "I've completed several tool operations. Let me know if you need anything else.";
  appendMessage(sessionId, {
    role: "assistant",
    content: [{ type: "text", text: fallback }],
    timestamp: new Date().toISOString(),
  });
  return { reply: fallback, toolCalls: totalToolCalls };
}
