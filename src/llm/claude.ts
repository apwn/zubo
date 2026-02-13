import Anthropic from "@anthropic-ai/sdk";
import type {
  LlmProvider,
  LlmRequest,
  LlmResponse,
  LlmContentBlock,
  LlmStreamEvent,
} from "./provider";
import { logger } from "../util/logger";

export class ClaudeProvider implements LlmProvider {
  providerName = "anthropic";
  model: string;
  contextWindow = 200_000;
  private client: Anthropic;

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

  async *chatStream(request: LlmRequest): AsyncIterable<LlmStreamEvent> {
    logger.debug("Claude stream request", {
      messageCount: request.messages.length,
      toolCount: request.tools?.length ?? 0,
    });

    const params: any = {
      model: this.model,
      max_tokens: request.maxTokens ?? 4096,
      system: request.system,
      messages: request.messages as any,
    };
    if (request.tools?.length) {
      params.tools = request.tools as any;
    }

    const stream = this.client.messages.stream(params);

    // Collect full response for the final message_done event
    const contentBlocks: LlmContentBlock[] = [];
    let currentToolId = "";
    let currentToolName = "";
    let currentToolJson = "";
    let inputTokens = 0;
    let outputTokens = 0;
    let stopReason = "end_turn";

    for await (const event of stream) {
      if (event.type === "message_start") {
        const msg = (event as any).message;
        if (msg?.usage) {
          inputTokens = msg.usage.input_tokens ?? 0;
        }
      } else if (event.type === "message_delta") {
        const delta = (event as any).delta;
        if (delta?.stop_reason) stopReason = delta.stop_reason;
        const usage = (event as any).usage;
        if (usage?.output_tokens) outputTokens = usage.output_tokens;
      } else if (event.type === "content_block_start") {
        const block = (event as any).content_block;
        if (block?.type === "tool_use") {
          currentToolId = block.id;
          currentToolName = block.name;
          currentToolJson = "";
          yield { type: "tool_use_start", id: block.id, name: block.name };
        }
      } else if (event.type === "content_block_delta") {
        const delta = (event as any).delta;
        if (delta?.type === "text_delta" && delta.text) {
          yield { type: "text_delta", text: delta.text };
        } else if (delta?.type === "input_json_delta" && delta.partial_json) {
          currentToolJson += delta.partial_json;
          yield { type: "tool_use_delta", id: currentToolId, json: delta.partial_json };
        }
      } else if (event.type === "content_block_stop") {
        if (currentToolId) {
          let input: Record<string, unknown> = {};
          try { input = JSON.parse(currentToolJson); } catch (err: any) { logger.warn("Failed to parse tool input JSON", { error: (err as Error).message }); }
          contentBlocks.push({
            type: "tool_use",
            id: currentToolId,
            name: currentToolName,
            input,
          });
          yield { type: "tool_use_end", id: currentToolId };
          currentToolId = "";
          currentToolName = "";
          currentToolJson = "";
        }
      }
    }

    // Collect final text from stream
    const finalMessage = await stream.finalMessage();
    // Build content blocks from final message for accuracy
    const finalContent: LlmContentBlock[] = finalMessage.content.map((block: any) => {
      if (block.type === "text") return { type: "text" as const, text: block.text };
      if (block.type === "tool_use") return { type: "tool_use" as const, id: block.id, name: block.name, input: block.input };
      return block;
    });

    yield {
      type: "message_done",
      response: {
        content: finalContent,
        stopReason: finalMessage.stop_reason ?? "end_turn",
        usage: {
          inputTokens: finalMessage.usage.input_tokens,
          outputTokens: finalMessage.usage.output_tokens,
        },
      },
    };
  }
}
