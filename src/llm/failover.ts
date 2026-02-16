import type { LlmProvider, LlmRequest, LlmResponse, LlmStreamEvent } from "./provider";
import { compactMessages } from "../agent/compaction";
import { logger } from "../util/logger";

/** Re-compact messages if the target provider has a smaller context window. */
function fitToProvider(request: LlmRequest, provider: LlmProvider): LlmRequest {
  const compacted = compactMessages(request.messages, provider.contextWindow);
  if (compacted === request.messages) return request;
  return { ...request, messages: compacted };
}

const PRIMARY_RETRY_INTERVAL_MS = 60_000; // Retry primary after 60 seconds

export class FailoverProvider implements LlmProvider {
  providerName: string;
  model: string;
  contextWindow: number;
  private failedOverAt: number = 0;

  constructor(
    private primary: LlmProvider,
    private fallbacks: LlmProvider[]
  ) {
    this.providerName = primary.providerName;
    this.model = primary.model;
    this.contextWindow = primary.contextWindow;
  }

  private get isOnPrimary(): boolean {
    return this.providerName === this.primary.providerName &&
      this.model === this.primary.model;
  }

  private restorePrimary(): void {
    this.providerName = this.primary.providerName;
    this.model = this.primary.model;
    this.contextWindow = this.primary.contextWindow;
    this.failedOverAt = 0;
    logger.info(`Recovered to primary provider: ${this.primary.providerName}/${this.primary.model}`);
  }

  private shouldRetryPrimary(): boolean {
    return !this.isOnPrimary &&
      this.failedOverAt > 0 &&
      Date.now() - this.failedOverAt >= PRIMARY_RETRY_INTERVAL_MS;
  }

  async chat(request: LlmRequest): Promise<LlmResponse> {
    // If we're on a fallback, periodically retry the primary
    if (this.shouldRetryPrimary()) {
      try {
        const result = await this.primary.chat(fitToProvider(request, this.primary));
        this.restorePrimary();
        return result;
      } catch {
        // Primary still down, continue with fallbacks below
        this.failedOverAt = Date.now();
      }
    }

    try {
      return await this.primary.chat(fitToProvider(request, this.primary));
    } catch (err: any) {
      logger.warn(`Primary provider (${this.primary.providerName}) failed`, {
        error: err.message,
      });

      for (const fb of this.fallbacks) {
        try {
          logger.info(`Trying fallback: ${fb.providerName}/${fb.model}`);
          const result = await fb.chat(fitToProvider(request, fb));
          this.providerName = fb.providerName;
          this.model = fb.model;
          this.failedOverAt = Date.now();
          return result;
        } catch (fbErr: any) {
          logger.warn(`Fallback ${fb.providerName} also failed`, {
            error: fbErr.message,
          });
        }
      }

      throw new Error(
        `All providers failed. Primary: ${err.message}`
      );
    }
  }

  async *chatStream(request: LlmRequest): AsyncIterable<LlmStreamEvent> {
    const MAX_STREAM_EVENTS = 50_000;

    // Collect all events from a stream — if it succeeds fully, yield them.
    // This prevents partial output from a failing stream from corrupting state.
    async function collectStream(provider: LlmProvider): Promise<LlmStreamEvent[] | null> {
      if (!provider.chatStream) return null;
      const events: LlmStreamEvent[] = [];
      try {
        for await (const event of provider.chatStream(fitToProvider(request, provider))) {
          if (events.length >= MAX_STREAM_EVENTS) {
            throw new Error(`Stream exceeded maximum event limit (${MAX_STREAM_EVENTS})`);
          }
          events.push(event);
        }
        return events;
      } catch (err: any) {
        logger.warn(`Stream from ${provider.providerName} failed after ${events.length} events`, {
          error: err.message,
        });
        return null;
      }
    }

    // If we're on a fallback, periodically retry the primary
    if (this.shouldRetryPrimary()) {
      const retryEvents = await collectStream(this.primary);
      if (retryEvents) {
        this.restorePrimary();
        for (const event of retryEvents) yield event;
        return;
      }
      this.failedOverAt = Date.now();
    }

    // Try primary
    const primaryEvents = await collectStream(this.primary);
    if (primaryEvents) {
      for (const event of primaryEvents) yield event;
      return;
    }

    // Try fallbacks
    for (const fb of this.fallbacks) {
      const fbEvents = await collectStream(fb);
      if (fbEvents) {
        this.providerName = fb.providerName;
        this.model = fb.model;
        this.failedOverAt = Date.now();
        for (const event of fbEvents) yield event;
        return;
      }
    }

    // If no provider supports streaming, fall back to non-streaming (chat() already handles fitToProvider)
    logger.info("No streaming providers available, falling back to non-streaming");
    const response = await this.chat(request);
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
