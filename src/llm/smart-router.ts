import type {
  LlmProvider,
  LlmRequest,
  LlmResponse,
  LlmStreamEvent,
} from "./provider";
import { compactMessages } from "../agent/compaction";
import { logger } from "../util/logger";

/** Re-compact messages if the target provider has a smaller context window. */
function fitToProvider(request: LlmRequest, provider: LlmProvider): LlmRequest {
  const compacted = compactMessages(request.messages, provider.contextWindow);
  if (compacted === request.messages) return request;
  return { ...request, messages: compacted };
}

const CODE_MARKERS = [
  "```",
  "function ",
  "const ",
  "let ",
  "var ",
  "import ",
  "export ",
  "class ",
  "interface ",
  "=>",
  "async ",
  "await ",
  "return ",
  ".ts",
  ".js",
  ".py",
  ".tsx",
  ".jsx",
  "/src/",
  "/lib/",
  "/bin/",
  "node_modules",
];

const MULTI_STEP_INDICATORS = [
  "step by step",
  "analyze",
  "compare",
  "implement",
  "refactor",
  "debug",
  "build",
  "create a",
  "write a",
  "design",
  "architect",
  "optimize",
  "migrate",
  "convert",
  "transform",
];

const REASONING_INDICATORS = [
  "why",
  "how does",
  "explain in detail",
  "trade-offs",
  "tradeoffs",
  "pros and cons",
  "what are the differences",
  "elaborate",
  "break down",
  "walk me through",
  "reasoning",
  "implications",
];

/**
 * Classify whether a user message is "simple" (can be handled by a fast/cheap model)
 * or "complex" (needs the primary/expensive model).
 */
export function classifyComplexity(text: string): "simple" | "complex" {
  const lower = text.toLowerCase().trim();
  const words = lower.split(/\s+/).filter(Boolean);
  const wordCount = words.length;

  // Long messages are complex
  if (wordCount >= 50) {
    return "complex";
  }

  // Check for code markers
  for (const marker of CODE_MARKERS) {
    if (lower.includes(marker)) {
      return "complex";
    }
  }

  // Check for multi-step indicators
  for (const indicator of MULTI_STEP_INDICATORS) {
    if (lower.includes(indicator)) {
      return "complex";
    }
  }

  // Check for reasoning indicators
  for (const indicator of REASONING_INDICATORS) {
    if (lower.includes(indicator)) {
      return "complex";
    }
  }

  // Short messages with no complexity markers are simple
  return "simple";
}

export class SmartRouterProvider implements LlmProvider {
  providerName: string;
  model: string;
  contextWindow: number;

  constructor(
    private primary: LlmProvider,
    private fast: LlmProvider,
    private enabled: boolean,
  ) {
    this.providerName = primary.providerName;
    this.model = primary.model;
    this.contextWindow = primary.contextWindow;
  }

  private selectProvider(request: LlmRequest): LlmProvider {
    if (!this.enabled) {
      return this.primary;
    }

    // Extract the last user message text for classification
    const lastUserMsg = [...request.messages]
      .reverse()
      .find((m) => m.role === "user");

    if (!lastUserMsg) {
      return this.primary;
    }

    const text = typeof lastUserMsg.content === "string"
      ? lastUserMsg.content
      : lastUserMsg.content
          .filter((b) => b.type === "text")
          .map((b) => b.text ?? "")
          .join(" ");

    const complexity = classifyComplexity(text);

    if (complexity === "simple") {
      logger.info("Smart router: using fast model", {
        provider: this.fast.providerName,
        model: this.fast.model,
        reason: "simple query",
      });
      return this.fast;
    }

    logger.info("Smart router: using primary model", {
      provider: this.primary.providerName,
      model: this.primary.model,
      reason: "complex query",
    });
    return this.primary;
  }

  async chat(request: LlmRequest): Promise<LlmResponse> {
    const provider = this.selectProvider(request);

    if (provider === this.fast) {
      try {
        return await provider.chat(fitToProvider(request, provider));
      } catch (err: any) {
        logger.warn("Fast model failed, falling back to primary", {
          error: err.message,
        });
        return this.primary.chat(fitToProvider(request, this.primary));
      }
    }

    return provider.chat(fitToProvider(request, provider));
  }

  async *chatStream(request: LlmRequest): AsyncIterable<LlmStreamEvent> {
    const MAX_STREAM_EVENTS = 50_000;
    const provider = this.selectProvider(request);

    if (provider === this.fast) {
      // Try fast model with fallback to primary
      if (provider.chatStream) {
        const events: LlmStreamEvent[] = [];
        let succeeded = false;
        try {
          for await (const event of provider.chatStream(fitToProvider(request, provider))) {
            if (events.length >= MAX_STREAM_EVENTS) {
              throw new Error(`Stream exceeded maximum event limit (${MAX_STREAM_EVENTS})`);
            }
            events.push(event);
          }
          succeeded = true;
        } catch (err: any) {
          logger.warn("Fast model stream failed, falling back to primary", {
            error: err.message,
          });
        }

        if (succeeded) {
          for (const event of events) {
            yield event;
          }
          return;
        }

        // Fallback to primary stream
      } else {
        // Fast model has no streaming, fall back to primary
        logger.info("Fast model has no streaming support, using primary");
      }
    }

    // Use primary model (streaming or non-streaming fallback)
    if (this.primary.chatStream) {
      yield* this.primary.chatStream(fitToProvider(request, this.primary));
    } else {
      const response = await this.primary.chat(fitToProvider(request, this.primary));
      for (const block of response.content) {
        if (block.type === "text" && block.text) {
          yield { type: "text_delta", text: block.text };
        } else if (block.type === "tool_use") {
          yield { type: "tool_use_start", id: block.id!, name: block.name! };
          yield { type: "tool_use_end", id: block.id! };
        }
      }
      yield { type: "message_done", response };
    }
  }
}
