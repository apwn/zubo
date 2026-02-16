import type { LlmProvider, LlmMessage, LlmContentBlock, LlmResponse } from "../llm/provider";
import { getAllToolDefs } from "../tools/registry";
import { executeTool } from "../tools/executor";
import { appendMessage, loadSession } from "./session";
import { assembleContext } from "./context";
import { compactMessages } from "./compaction";
import { maybeCompactSession } from "./summarizer";
import { getDb } from "../db/connection";
import { logger } from "../util/logger";

const MAX_TOOL_ROUNDS = 10;
const CHAT_TIMEOUT_MS = 120_000; // 2 minutes

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

export interface StreamCallbacks {
  onTextDelta: (text: string) => void;
  onToolStart?: (name: string, id: string) => void;
  onToolEnd?: (name: string, id: string) => void;
  onDone: (result: LoopResult) => void;
  onError: (error: Error) => void;
}

// --- Shared setup logic ---

function resolveOptions(memoriesOrOptions: string | AgentLoopOptions): AgentLoopOptions {
  return typeof memoriesOrOptions === "string"
    ? { memories: memoriesOrOptions }
    : memoriesOrOptions;
}

/** Detect simple greetings/chat that don't need tool definitions in context. */
function looksConversational(text: string): boolean {
  const t = text.trim().toLowerCase();
  if (t.split(/\s+/).length > 8) return false; // longer messages likely need tools
  const greetings = /^(h(ello|i|ey|owdy|ola)|yo|sup|good\s*(morning|afternoon|evening|night)|what'?s\s*up|gm|thanks|thank\s*you|ok(ay)?|bye|see\s*ya|cool|nice|wow|lol|haha)\b/;
  return greetings.test(t);
}

async function prepareLoop(
  llm: LlmProvider,
  sessionId: string,
  userMessage: string,
  options: AgentLoopOptions
): Promise<{ system: string; messages: LlmMessage[]; tools: any[] }> {
  // Persist user message
  appendMessage(sessionId, {
    role: "user",
    content: [{ type: "text", text: userMessage }],
    timestamp: new Date().toISOString(),
  });

  const memories = options.memories ?? "";

  // Knowledge graph context injection
  let kgContext = "";
  try {
    const { buildKgContext } = require("../memory/knowledge-graph");
    const db = getDb();
    kgContext = buildKgContext(db, userMessage);
  } catch {
    // KG tables may not exist yet
  }

  const fullMemories = kgContext
    ? (memories ? `${memories}\n\nKnown context:\n${kgContext}` : `Known context:\n${kgContext}`)
    : memories;

  // Assemble context (uses static import — no dynamic import overhead)
  const ctx = options.systemPromptOverride
    ? { system: options.systemPromptOverride, messages: loadSession(sessionId, 50) }
    : assembleContext(sessionId, 50, fullMemories);

  const messages = compactMessages(ctx.messages, llm.contextWindow);

  // Filter tools — skip for simple conversational messages to reduce context
  // for small models. Tools are still available on subsequent rounds.
  let tools = getAllToolDefs();
  if (options.allowedTools) {
    const allowed = new Set(options.allowedTools);
    tools = tools.filter((t) => allowed.has(t.name));
  } else if (looksConversational(userMessage)) {
    tools = [];
  }

  return { system: ctx.system, messages, tools };
}

function trackUsage(
  llm: LlmProvider,
  sessionId: string,
  response: LlmResponse,
  responseTimeMs: number
): void {
  try {
    const { estimateCost } = require("../util/costs");
    const costUsd = estimateCost(llm.model, response.usage.inputTokens, response.usage.outputTokens);
    const db = getDb();
    db.prepare(
      "INSERT INTO usage (session_id, provider, model, input_tokens, output_tokens, response_time_ms, cost_usd) VALUES (?, ?, ?, ?, ?, ?, ?)"
    ).run(sessionId, llm.providerName, llm.model, response.usage.inputTokens, response.usage.outputTokens, responseTimeMs, costUsd);
  } catch {
    // Usage table may not exist yet; don't break the loop
  }
}

type ToolUseBlock = LlmContentBlock & {
  type: "tool_use"; id: string; name: string; input: Record<string, unknown>;
};

function extractToolUseBlocks(content: LlmContentBlock[]): ToolUseBlock[] {
  return content.filter((b): b is ToolUseBlock => b.type === "tool_use");
}

async function executeToolBlocks(
  blocks: ToolUseBlock[],
  allowedTools: string[] | undefined,
  onToolStart?: (name: string, id: string) => void,
  onToolEnd?: (name: string, id: string) => void
): Promise<{ results: LlmContentBlock[]; count: number }> {
  // Signal all tool starts immediately
  for (const block of blocks) {
    onToolStart?.(block.name, block.id);
  }

  // Execute all tools in parallel
  const resultPromises = blocks.map(async (block) => {
    const result = await executeTool(block.name, block.id, block.input, allowedTools);
    onToolEnd?.(block.name, block.id);
    return {
      type: "tool_result" as const,
      tool_use_id: result.tool_use_id,
      content: result.content,
      is_error: result.is_error,
    };
  });

  const results: LlmContentBlock[] = await Promise.all(resultPromises);
  return { results, count: blocks.length };
}

function persistToolRound(
  sessionId: string,
  assistantContent: LlmContentBlock[],
  toolResults: LlmContentBlock[],
  messages: LlmMessage[]
): void {
  appendMessage(sessionId, {
    role: "assistant",
    content: assistantContent,
    timestamp: new Date().toISOString(),
  });
  messages.push({ role: "assistant", content: assistantContent });

  appendMessage(sessionId, {
    role: "user",
    content: toolResults,
    timestamp: new Date().toISOString(),
  });
  messages.push({ role: "user", content: toolResults });
}

function finishLoop(sessionId: string, reply: string): void {
  appendMessage(sessionId, {
    role: "assistant",
    content: [{ type: "text", text: reply }],
    timestamp: new Date().toISOString(),
  });
}

const MAX_ROUNDS_FALLBACK = "I've completed several tool operations. Let me know if you need anything else.";

// --- Post-loop summarization ---

const compactionInProgress = new Set<string>();

function triggerPostLoopCompaction(llm: LlmProvider, sessionId: string): void {
  if (compactionInProgress.has(sessionId)) return;
  compactionInProgress.add(sessionId);

  maybeCompactSession(llm, sessionId)
    .catch((err) => {
      logger.error("Post-loop compaction failed", { sessionId, error: String(err) });
    })
    .finally(() => {
      compactionInProgress.delete(sessionId);
    });
}

// --- Public API ---

export async function agentLoop(
  llm: LlmProvider,
  sessionId: string,
  userMessage: string,
  memoriesOrOptions: string | AgentLoopOptions = ""
): Promise<LoopResult> {
  const options = resolveOptions(memoriesOrOptions);
  const maxRounds = options.maxRounds ?? MAX_TOOL_ROUNDS;
  const { system, messages, tools } = await prepareLoop(llm, sessionId, userMessage, options);

  let totalToolCalls = 0;

  for (let round = 0; round < maxRounds; round++) {
    const llmStartTime = Date.now();
    let timeoutHandle: ReturnType<typeof setTimeout>;
    const response = await Promise.race([
      llm.chat({
        system,
        messages,
        tools: tools.length > 0 ? tools : undefined,
        maxTokens: 4096,
      }),
      new Promise<never>((_, reject) => {
        timeoutHandle = setTimeout(() => reject(new Error("LLM request timed out after 120s")), CHAT_TIMEOUT_MS);
      }),
    ]);
    clearTimeout(timeoutHandle!);
    trackUsage(llm, sessionId, response, Date.now() - llmStartTime);

    logger.debug("LLM response", {
      provider: llm.providerName,
      stopReason: response.stopReason,
      blocks: response.content.length,
      inputTokens: response.usage.inputTokens,
      outputTokens: response.usage.outputTokens,
    });

    const toolUseBlocks = extractToolUseBlocks(response.content);

    // No tool calls — done
    if (toolUseBlocks.length === 0) {
      const reply = response.content
        .filter((b) => b.type === "text")
        .map((b) => b.text ?? "")
        .join("\n") || "";
      finishLoop(sessionId, reply);
      triggerPostLoopCompaction(llm, sessionId);
      return { reply, toolCalls: totalToolCalls };
    }

    // Execute tools
    const { results, count } = await executeToolBlocks(toolUseBlocks, options.allowedTools);
    totalToolCalls += count;
    persistToolRound(sessionId, response.content, results, messages);
  }

  finishLoop(sessionId, MAX_ROUNDS_FALLBACK);
  triggerPostLoopCompaction(llm, sessionId);
  return { reply: MAX_ROUNDS_FALLBACK, toolCalls: totalToolCalls };
}

export async function agentLoopStream(
  llm: LlmProvider,
  sessionId: string,
  userMessage: string,
  callbacks: StreamCallbacks,
  memoriesOrOptions: string | AgentLoopOptions = ""
): Promise<void> {
  const options = resolveOptions(memoriesOrOptions);
  const maxRounds = options.maxRounds ?? MAX_TOOL_ROUNDS;

  // Fall back to non-streaming if provider doesn't support it
  if (!llm.chatStream) {
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
    const { system, messages, tools } = await prepareLoop(llm, sessionId, userMessage, options);

    let totalToolCalls = 0;
    let fullReply = "";

    for (let round = 0; round < maxRounds; round++) {
      let roundText = "";
      let roundResponse: LlmResponse | null = null;
      const llmStartTime = Date.now();

      let streamTimeoutHandle: ReturnType<typeof setTimeout>;
      await Promise.race([
        (async () => {
          for await (const event of llm.chatStream!({
            system,
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
        })(),
        new Promise<never>((_, reject) => {
          streamTimeoutHandle = setTimeout(() => reject(new Error("LLM request timed out after 120s")), CHAT_TIMEOUT_MS);
        }),
      ]);
      clearTimeout(streamTimeoutHandle!);

      if (!roundResponse) throw new Error("Stream ended without message_done event");
      const completed = roundResponse as LlmResponse;
      trackUsage(llm, sessionId, completed, Date.now() - llmStartTime);

      const toolUseBlocks = extractToolUseBlocks(completed.content);

      // No tool calls — done
      if (toolUseBlocks.length === 0) {
        const reply = completed.content
          .filter((b: LlmContentBlock) => b.type === "text")
          .map((b: LlmContentBlock) => (b as any).text ?? "")
          .join("\n") || roundText;
        fullReply += reply;
        finishLoop(sessionId, fullReply);
        triggerPostLoopCompaction(llm, sessionId);
        callbacks.onDone({ reply: fullReply, toolCalls: totalToolCalls });
        return;
      }

      // Execute tools
      const { results, count } = await executeToolBlocks(
        toolUseBlocks, options.allowedTools,
        callbacks.onToolStart, callbacks.onToolEnd
      );
      totalToolCalls += count;
      persistToolRound(sessionId, completed.content, results, messages);

      if (roundText) fullReply += roundText;
    }

    finishLoop(sessionId, MAX_ROUNDS_FALLBACK);
    triggerPostLoopCompaction(llm, sessionId);
    callbacks.onDone({ reply: MAX_ROUNDS_FALLBACK, toolCalls: totalToolCalls });
  } catch (err: any) {
    callbacks.onError(err);
  }
}
