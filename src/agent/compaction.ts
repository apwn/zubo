import type { LlmMessage } from "../llm/provider";
import { estimateTokens } from "../util/tokens";
import { logger } from "../util/logger";

const DEFAULT_CONTEXT_WINDOW = 150_000;
const MSG_OVERHEAD = 4; // per-message token overhead

function messageTokens(m: LlmMessage): number {
  const text = typeof m.content === "string" ? m.content : JSON.stringify(m.content);
  return estimateTokens(text) + MSG_OVERHEAD;
}

/**
 * Trim messages if they exceed the context window.
 * Keeps the most recent messages, drops oldest.
 * O(n) — computes per-message costs once and subtracts as we drop.
 */
export function compactMessages(
  messages: LlmMessage[],
  contextWindow?: number
): LlmMessage[] {
  const maxTokens = contextWindow ?? DEFAULT_CONTEXT_WINDOW;
  const target = Math.floor(maxTokens * 0.66);

  // Compute total tokens in one pass
  const costs = messages.map(messageTokens);
  let tokens = 0;
  for (const c of costs) tokens += c;

  if (tokens <= maxTokens) return messages;

  logger.info("Compacting context", {
    currentTokens: tokens,
    target,
    contextWindow: maxTokens,
  });

  // Find the start index where cumulative remaining tokens fit under target
  let startIdx = 0;
  while (startIdx < messages.length - 2 && tokens > target) {
    tokens -= costs[startIdx];
    startIdx++;
  }

  // Ensure first message is from user (Claude API requirement)
  while (startIdx < messages.length && messages[startIdx].role !== "user") {
    startIdx++;
  }

  const compacted = messages.slice(startIdx);
  logger.info("Compaction done", { remainingMessages: compacted.length });
  return compacted;
}
