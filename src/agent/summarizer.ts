import type { LlmProvider, LlmMessage, LlmContentBlock } from "../llm/provider";
import type { SessionMessage } from "./session";
import { loadSessionFull, rewriteSession } from "./session";
import { estimateTokens } from "../util/tokens";
import { logger } from "../util/logger";

const MSG_OVERHEAD = 4;
const MIN_MESSAGES_FOR_SUMMARY = 16;
const KEEP_RECENT = 10;
const THRESHOLD_RATIO = 0.6;

const SUMMARY_MARKER = "Previous conversation summary:";

// --- Token estimation ---

function messageTokens(m: LlmMessage | SessionMessage): number {
  const content = "content" in m ? m.content : "";
  const text = typeof content === "string" ? content : JSON.stringify(content);
  return estimateTokens(text) + MSG_OVERHEAD;
}

function totalTokens(messages: SessionMessage[]): number {
  let sum = 0;
  for (const m of messages) sum += messageTokens(m);
  return sum;
}

// --- Public helpers ---

export function needsSummarization(
  messages: SessionMessage[],
  contextWindow: number
): boolean {
  if (messages.length < MIN_MESSAGES_FOR_SUMMARY) return false;
  const tokens = totalTokens(messages);
  return tokens > contextWindow * THRESHOLD_RATIO;
}

export function partitionMessages(
  messages: SessionMessage[]
): { toSummarize: SessionMessage[]; toKeep: SessionMessage[] } {
  if (messages.length <= KEEP_RECENT) {
    return { toSummarize: [], toKeep: messages };
  }
  const splitAt = messages.length - KEEP_RECENT;
  return {
    toSummarize: messages.slice(0, splitAt),
    toKeep: messages.slice(splitAt),
  };
}

/**
 * Convert messages to text-only format for the summarization prompt.
 * Strips tool_use/tool_result blocks to brief placeholders.
 */
export function toTextOnlyMessages(
  messages: SessionMessage[]
): { role: string; text: string }[] {
  const result: { role: string; text: string }[] = [];

  for (const msg of messages) {
    const content = msg.content;

    if (typeof content === "string") {
      if (content.trim()) result.push({ role: msg.role, text: content });
      continue;
    }

    if (!Array.isArray(content)) continue;

    const parts: string[] = [];
    for (const block of content as LlmContentBlock[]) {
      switch (block.type) {
        case "text":
          if (block.text?.trim()) parts.push(block.text);
          break;
        case "tool_use":
          parts.push(`[Used tool: ${block.name ?? "unknown"}]`);
          break;
        case "tool_result": {
          const raw = typeof block.content === "string" ? block.content : "";
          const truncated =
            raw.length > 200 ? raw.slice(0, 200) + "…" : raw;
          if (block.is_error) {
            parts.push(`[Tool error: ${truncated}]`);
          } else if (truncated) {
            parts.push(`[Tool result: ${truncated}]`);
          }
          break;
        }
      }
    }

    if (parts.length > 0) {
      result.push({ role: msg.role, text: parts.join("\n") });
    }
  }

  return result;
}

/**
 * Determine summary token budget based on context window size.
 */
function summaryBudget(contextWindow: number): number {
  if (contextWindow <= 16_000) return 400;
  if (contextWindow <= 64_000) return 800;
  return 1200;
}

/**
 * Call the LLM to generate a summary of the conversation.
 */
export async function generateSummary(
  llm: LlmProvider,
  messages: SessionMessage[]
): Promise<string | null> {
  const textMessages = toTextOnlyMessages(messages);
  if (textMessages.length === 0) return null;

  const conversationText = textMessages
    .map((m) => `${m.role}: ${m.text}`)
    .join("\n\n");

  const budget = summaryBudget(llm.contextWindow);

  try {
    const response = await llm.chat({
      system:
        "You are a conversation summarizer. Produce a concise summary of the conversation below. " +
        "Preserve key facts, decisions, user preferences, and any important context the assistant would need " +
        "to continue the conversation naturally. Do NOT include greetings or filler. Be factual and dense.",
      messages: [
        {
          role: "user",
          content: `Summarize this conversation in under ${budget} tokens:\n\n${conversationText}`,
        },
      ],
      maxTokens: budget,
    });

    const summary = response.content
      .filter((b) => b.type === "text")
      .map((b) => b.text ?? "")
      .join("\n")
      .trim();

    return summary || null;
  } catch (err: any) {
    logger.error("Summary generation failed", { error: err.message });
    return null;
  }
}

/**
 * Orchestrator: check if session needs summarization, generate summary, rewrite session.
 * Returns true if summarization was performed.
 */
export async function maybeCompactSession(
  llm: LlmProvider,
  sessionId: string
): Promise<boolean> {
  const messages = loadSessionFull(sessionId);
  if (messages.length === 0) return false;

  if (!needsSummarization(messages, llm.contextWindow)) {
    return false;
  }

  logger.info("Session needs summarization", {
    sessionId,
    messageCount: messages.length,
    estimatedTokens: totalTokens(messages),
    contextWindow: llm.contextWindow,
  });

  const { toSummarize, toKeep } = partitionMessages(messages);
  if (toSummarize.length === 0) return false;

  const summary = await generateSummary(llm, toSummarize);
  if (!summary) {
    logger.warn("Summarization produced no output, skipping rewrite", {
      sessionId,
    });
    return false;
  }

  const summaryMessage: SessionMessage = {
    role: "user",
    content: [{ type: "text", text: `${SUMMARY_MARKER}\n${summary}` }],
    timestamp: new Date().toISOString(),
    __summary: true,
    __summarizedCount: toSummarize.length,
  };

  // Ensure no consecutive user messages (breaks Claude API).
  // If first kept message is also user, insert a minimal assistant bridge.
  let kept = toKeep;
  if (kept.length > 0 && kept[0].role === "user") {
    const bridge: SessionMessage = {
      role: "assistant",
      content: [{ type: "text", text: "(Continuing from summary.)" }],
      timestamp: new Date().toISOString(),
    };
    kept = [bridge, ...kept];
  }

  // Re-read session to capture any messages appended during summarization
  const freshMessages = loadSessionFull(sessionId);
  const newMessagesSince = freshMessages.slice(messages.length);

  const newMessages = [summaryMessage, ...kept, ...newMessagesSince];
  rewriteSession(sessionId, newMessages);

  logger.info("Session summarized successfully", {
    sessionId,
    summarizedMessages: toSummarize.length,
    keptMessages: toKeep.length,
    summaryLength: summary.length,
  });

  return true;
}
