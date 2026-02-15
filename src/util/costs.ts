/**
 * Model pricing table (per 1M tokens, in USD).
 * Updated as of late 2025.
 */
const MODEL_PRICING: Record<string, { input: number; output: number }> = {
  // Anthropic
  "claude-sonnet-4-5-20250929": { input: 3.0, output: 15.0 },
  "claude-haiku-4-5-20251001": { input: 0.8, output: 4.0 },
  "claude-opus-4-6": { input: 15.0, output: 75.0 },

  // OpenAI
  "gpt-4.1": { input: 2.0, output: 8.0 },
  "gpt-4.1-mini": { input: 0.4, output: 1.6 },
  "gpt-4.1-nano": { input: 0.1, output: 0.4 },
  "gpt-4o": { input: 2.5, output: 10.0 },
  "gpt-4o-mini": { input: 0.15, output: 0.6 },
  "o1-mini": { input: 1.1, output: 4.4 },
  "o3-mini": { input: 1.1, output: 4.4 },

  // xAI
  "grok-4.1-fast": { input: 0.2, output: 0.5 },

  // DeepSeek
  "deepseek-chat": { input: 0.56, output: 1.68 },
  "deepseek-reasoner": { input: 0.55, output: 2.19 },

  // MiniMax
  "MiniMax-M2.5": { input: 0.3, output: 1.2 },
  "MiniMax-M2.5-highspeed": { input: 0.3, output: 2.4 },

  // Groq
  "llama-3.3-70b-versatile": { input: 0.59, output: 0.79 },
  "llama-3.1-8b-instant": { input: 0.05, output: 0.08 },

  // Together
  "meta-llama/Llama-3.3-70B-Instruct-Turbo": { input: 0.88, output: 0.88 },

  // OpenRouter — pricing depends on underlying model, use provider's pricing
  "anthropic/claude-sonnet-4-5": { input: 3.0, output: 15.0 },

  // Default fallback (free / local)
  _default: { input: 0, output: 0 },
};

/**
 * Estimate cost in USD for a given model and token counts.
 */
export function estimateCost(
  model: string,
  inputTokens: number,
  outputTokens: number
): number {
  // Try exact match first, then prefix match
  let pricing = MODEL_PRICING[model];
  if (!pricing) {
    const key = Object.keys(MODEL_PRICING).find((k) => model.startsWith(k));
    pricing = key ? MODEL_PRICING[key] : MODEL_PRICING._default;
  }

  const inputCost = (inputTokens / 1_000_000) * pricing.input;
  const outputCost = (outputTokens / 1_000_000) * pricing.output;
  return Math.round((inputCost + outputCost) * 1_000_000) / 1_000_000; // 6 decimal places
}
