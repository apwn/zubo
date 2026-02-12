import type { LlmMessage } from "../llm/provider";
import { estimateMessagesTokens } from "../util/tokens";
import { logger } from "../util/logger";

const DEFAULT_CONTEXT_WINDOW = 150_000;

/**
 * Trim messages if they exceed the context window.
 * Keeps the most recent messages, drops oldest.
 */
export function compactMessages(
  messages: LlmMessage[],
  contextWindow?: number
): LlmMessage[] {
  const maxTokens = contextWindow ?? DEFAULT_CONTEXT_WINDOW;
  const target = Math.floor(maxTokens * 0.66);

  let tokens = estimateMessagesTokens(
    messages.map((m) => ({
      role: m.role,
      content: typeof m.content === "string" ? m.content : JSON.stringify(m.content),
    }))
  );

  if (tokens <= maxTokens) return messages;

  logger.info("Compacting context", {
    currentTokens: tokens,
    target,
    contextWindow: maxTokens,
  });

  // Drop messages from the front until under target
  const compacted = [...messages];
  while (
    compacted.length > 2 &&
    estimateMessagesTokens(
      compacted.map((m) => ({
        role: m.role,
        content: typeof m.content === "string" ? m.content : JSON.stringify(m.content),
      }))
    ) > target
  ) {
    compacted.shift();
  }

  // Ensure first message is from user (Claude API requirement)
  while (compacted.length > 0 && compacted[0].role !== "user") {
    compacted.shift();
  }

  logger.info("Compaction done", { remainingMessages: compacted.length });
  return compacted;
}
