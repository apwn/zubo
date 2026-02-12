import Anthropic from "@anthropic-ai/sdk";
import type {
  LlmProvider,
  LlmRequest,
  LlmResponse,
  LlmContentBlock,
} from "./provider";
import { logger } from "../util/logger";

export class ClaudeProvider implements LlmProvider {
  private client: Anthropic;
  private model: string;

  constructor(apiKey: string, model: string) {
    this.client = new Anthropic({ apiKey });
    this.model = model;
  }

  async chat(request: LlmRequest): Promise<LlmResponse> {
    logger.debug("Claude request", {
      messageCount: request.messages.length,
      toolCount: request.tools?.length ?? 0,
    });

    const response = await this.client.messages.create({
      model: this.model,
      max_tokens: request.maxTokens ?? 4096,
      system: request.system,
      messages: request.messages as any,
      tools: request.tools as any,
    });

    const content: LlmContentBlock[] = response.content.map((block: any) => {
      if (block.type === "text") {
        return { type: "text" as const, text: block.text };
      }
      if (block.type === "tool_use") {
        return {
          type: "tool_use" as const,
          id: block.id,
          name: block.name,
          input: block.input,
        };
      }
      return block;
    });

    return {
      content,
      stopReason: response.stop_reason ?? "end_turn",
      usage: {
        inputTokens: response.usage.input_tokens,
        outputTokens: response.usage.output_tokens,
      },
    };
  }
}
