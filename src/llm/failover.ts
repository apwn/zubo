import type { LlmProvider, LlmRequest, LlmResponse, LlmStreamEvent } from "./provider";
import { logger } from "../util/logger";

export class FailoverProvider implements LlmProvider {
  providerName: string;
  model: string;
  contextWindow: number;

  constructor(
    private primary: LlmProvider,
    private fallbacks: LlmProvider[]
  ) {
    this.providerName = primary.providerName;
    this.model = primary.model;
    this.contextWindow = primary.contextWindow;
  }

  async chat(request: LlmRequest): Promise<LlmResponse> {
    try {
      return await this.primary.chat(request);
    } catch (err: any) {
      logger.warn(`Primary provider (${this.primary.providerName}) failed`, {
        error: err.message,
      });

      for (const fb of this.fallbacks) {
        try {
          logger.info(`Trying fallback: ${fb.providerName}/${fb.model}`);
          const result = await fb.chat(request);
          this.providerName = fb.providerName;
          this.model = fb.model;
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
    // Try primary
    if (this.primary.chatStream) {
      try {
        yield* this.primary.chatStream(request);
        return;
      } catch (err: any) {
        logger.warn(`Primary stream (${this.primary.providerName}) failed`, {
          error: err.message,
        });
      }
    }

    // Try fallbacks
    for (const fb of this.fallbacks) {
      if (fb.chatStream) {
        try {
          logger.info(`Trying stream fallback: ${fb.providerName}/${fb.model}`);
          yield* fb.chatStream(request);
          this.providerName = fb.providerName;
          this.model = fb.model;
          return;
        } catch (fbErr: any) {
          logger.warn(`Stream fallback ${fb.providerName} failed`, {
            error: fbErr.message,
          });
        }
      }
    }

    // If no provider supports streaming, fall back to non-streaming
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
