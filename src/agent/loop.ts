import type { LlmProvider, LlmMessage, LlmContentBlock, LlmStreamEvent } from "../llm/provider";
import { getAllToolDefs } from "../tools/registry";
import { executeTool } from "../tools/executor";
import { appendMessage } from "./session";
import { assembleContext } from "./context";
import { compactMessages } from "./compaction";
import { getDb } from "../db/connection";
import { logger } from "../util/logger";

const MAX_TOOL_ROUNDS = 10;

export interface LoopResult {
  reply: string;
  toolCalls: number;
}

export interface AgentLoopOptions {
  systemPromptOverride?: string;
  allowedTools?: string[];
  maxRounds?: number;
  memories?: string;
}

export async function agentLoop(
  llm: LlmProvider,
  sessionId: string,
  userMessage: string,
  memoriesOrOptions: string | AgentLoopOptions = ""
): Promise<LoopResult> {
  // Backward-compatible: accept string (memories) or AgentLoopOptions
  const options: AgentLoopOptions =
    typeof memoriesOrOptions === "string"
      ? { memories: memoriesOrOptions }
      : memoriesOrOptions;

  const memories = options.memories ?? "";
  const maxRounds = options.maxRounds ?? MAX_TOOL_ROUNDS;

  // Persist user message
  appendMessage(sessionId, {
    role: "user",
    content: [{ type: "text", text: userMessage }],
    timestamp: new Date().toISOString(),
  });

  // Assemble context
  const ctx = options.systemPromptOverride
    ? { system: options.systemPromptOverride, messages: [] as LlmMessage[] }
    : assembleContext(sessionId, 50, memories);

  // If using a system prompt override but still need session history
  if (options.systemPromptOverride) {
    const { loadSession } = await import("./session");
    ctx.messages = loadSession(sessionId, 50);
    // Remove the user message we just appended (it's already in the messages from loadSession)
    // Actually loadSession will include it since we already appended it
  }

  let messages = compactMessages(ctx.messages, llm.contextWindow);

  // Filter tools if allowedTools is set
  let tools = getAllToolDefs();
  if (options.allowedTools) {
    const allowed = new Set(options.allowedTools);
    tools = tools.filter((t) => allowed.has(t.name));
  }

  let totalToolCalls = 0;

  for (let round = 0; round < maxRounds; round++) {
    const llmStartTime = Date.now();
    const response = await llm.chat({
      system: ctx.system,
      messages,
      tools: tools.length > 0 ? tools : undefined,
      maxTokens: 4096,
    });
    const responseTimeMs = Date.now() - llmStartTime;

    // Track usage with timing and cost
    try {
      const { estimateCost } = await import("../util/costs");
      const costUsd = estimateCost(llm.model, response.usage.inputTokens, response.usage.outputTokens);
      const db = getDb();
      db.prepare(
        "INSERT INTO usage (session_id, provider, model, input_tokens, output_tokens, response_time_ms, cost_usd) VALUES (?, ?, ?, ?, ?, ?, ?)"
      ).run(
        sessionId,
        llm.providerName,
        llm.model,
        response.usage.inputTokens,
        response.usage.outputTokens,
        responseTimeMs,
        costUsd
      );
    } catch {
      // Usage table may not exist yet; don't break the loop
    }

    logger.debug("LLM response", {
      provider: llm.providerName,
      stopReason: response.stopReason,
      blocks: response.content.length,
      inputTokens: response.usage.inputTokens,
      outputTokens: response.usage.outputTokens,
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
      const result = await executeTool(block.name, block.id, block.input, options.allowedTools);
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

// --- Streaming agent loop ---

export interface StreamCallbacks {
  onTextDelta: (text: string) => void;
  onToolStart?: (name: string, id: string) => void;
  onToolEnd?: (name: string, id: string) => void;
  onDone: (result: LoopResult) => void;
  onError: (error: Error) => void;
}

export async function agentLoopStream(
  llm: LlmProvider,
  sessionId: string,
  userMessage: string,
  callbacks: StreamCallbacks,
  memoriesOrOptions: string | AgentLoopOptions = ""
): Promise<void> {
  const options: AgentLoopOptions =
    typeof memoriesOrOptions === "string"
      ? { memories: memoriesOrOptions }
      : memoriesOrOptions;

  const memories = options.memories ?? "";
  const maxRounds = options.maxRounds ?? MAX_TOOL_ROUNDS;

  // Check if provider supports streaming
  if (!llm.chatStream) {
    // Fall back to non-streaming
    try {
      const result = await agentLoop(llm, sessionId, userMessage, memoriesOrOptions);
      callbacks.onTextDelta(result.reply);
      callbacks.onDone(result);
    } catch (err: any) {
      callbacks.onError(err);
    }
    return;
  }

  try {
    // Persist user message
    appendMessage(sessionId, {
      role: "user",
      content: [{ type: "text", text: userMessage }],
      timestamp: new Date().toISOString(),
    });

    // Assemble context
    const ctx = options.systemPromptOverride
      ? { system: options.systemPromptOverride, messages: [] as LlmMessage[] }
      : assembleContext(sessionId, 50, memories);

    if (options.systemPromptOverride) {
      const { loadSession } = await import("./session");
      ctx.messages = loadSession(sessionId, 50);
    }

    let messages = compactMessages(ctx.messages, llm.contextWindow);

    // Filter tools
    let tools = getAllToolDefs();
    if (options.allowedTools) {
      const allowed = new Set(options.allowedTools);
      tools = tools.filter((t) => allowed.has(t.name));
    }

    let totalToolCalls = 0;
    let fullReply = "";

    for (let round = 0; round < maxRounds; round++) {
      let roundText = "";
      let roundResponse: import("../llm/provider").LlmResponse | null = null;

      const llmStartTime = Date.now();

      // Stream the LLM response
      for await (const event of llm.chatStream!({
        system: ctx.system,
        messages,
        tools: tools.length > 0 ? tools : undefined,
        maxTokens: 4096,
      })) {
        switch (event.type) {
          case "text_delta":
            roundText += event.text;
            callbacks.onTextDelta(event.text);
            break;
          case "tool_use_start":
            callbacks.onToolStart?.(event.name, event.id);
            break;
          case "tool_use_end":
            callbacks.onToolEnd?.("", event.id);
            break;
          case "message_done":
            roundResponse = event.response;
            break;
        }
      }

      const responseTimeMs = Date.now() - llmStartTime;

      if (!roundResponse) {
        throw new Error("Stream ended without message_done event");
      }

      // Track usage with timing and cost
      try {
        const { estimateCost } = await import("../util/costs");
        const costUsd = estimateCost(llm.model, roundResponse.usage.inputTokens, roundResponse.usage.outputTokens);
        const db = getDb();
        db.prepare(
          "INSERT INTO usage (session_id, provider, model, input_tokens, output_tokens, response_time_ms, cost_usd) VALUES (?, ?, ?, ?, ?, ?, ?)"
        ).run(
          sessionId,
          llm.providerName,
          llm.model,
          roundResponse.usage.inputTokens,
          roundResponse.usage.outputTokens,
          responseTimeMs,
          costUsd
        );
      } catch {}

      // Extract tool calls from the complete response
      const toolUseBlocks = roundResponse.content.filter(
        (b): b is LlmContentBlock & {
          type: "tool_use"; id: string; name: string; input: Record<string, unknown>;
        } => b.type === "tool_use"
      );

      // No tool calls — we're done
      if (toolUseBlocks.length === 0) {
        const reply = roundResponse.content
          .filter((b) => b.type === "text")
          .map((b) => b.text ?? "")
          .join("\n") || roundText;

        fullReply += reply;

        appendMessage(sessionId, {
          role: "assistant",
          content: [{ type: "text", text: fullReply }],
          timestamp: new Date().toISOString(),
        });

        callbacks.onDone({ reply: fullReply, toolCalls: totalToolCalls });
        return;
      }

      // Has tool calls — persist and execute
      appendMessage(sessionId, {
        role: "assistant",
        content: roundResponse.content,
        timestamp: new Date().toISOString(),
      });
      messages.push({ role: "assistant", content: roundResponse.content });

      const toolResults: LlmContentBlock[] = [];
      for (const block of toolUseBlocks) {
        totalToolCalls++;
        callbacks.onToolStart?.(block.name, block.id);
        const result = await executeTool(block.name, block.id, block.input, options.allowedTools);
        toolResults.push({
          type: "tool_result",
          tool_use_id: result.tool_use_id,
          content: result.content,
          is_error: result.is_error,
        });
        callbacks.onToolEnd?.(block.name, block.id);
      }

      appendMessage(sessionId, {
        role: "user",
        content: toolResults,
        timestamp: new Date().toISOString(),
      });
      messages.push({ role: "user", content: toolResults });

      // Accumulate any text from this round
      if (roundText) fullReply += roundText;
    }

    // Max rounds
    const fallback = "I've completed several tool operations. Let me know if you need anything else.";
    appendMessage(sessionId, {
      role: "assistant",
      content: [{ type: "text", text: fallback }],
      timestamp: new Date().toISOString(),
    });
    callbacks.onDone({ reply: fallback, toolCalls: totalToolCalls });
  } catch (err: any) {
    callbacks.onError(err);
  }
}
