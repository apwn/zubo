/**
 * Rough token count estimation.
 * ~4 chars per token for English text (GPT/Claude approximation).
 */
export function estimateTokens(text: string): number {
  return Math.ceil(text.length / 4);
}

export function estimateMessagesTokens(
  messages: Array<{ role: string; content: string }>
): number {
  let total = 0;
  for (const msg of messages) {
    total += estimateTokens(msg.content) + 4; // overhead per message
  }
  return total;
}
