import type {
  LlmProvider,
  LlmRequest,
  LlmResponse,
  LlmContentBlock,
  LlmToolDef,
} from "./provider";
import { logger } from "../util/logger";

export interface OpenAICompatOptions {
  name: string;
  baseUrl: string;
  apiKey: string;
  model: string;
  maxTokens?: number;
  streaming?: boolean;
  contextWindow?: number;
}

const DEFAULT_CONTEXT_WINDOWS: Record<string, number> = {
  openai: 128_000,
  groq: 128_000,
  together: 32_000,
  openrouter: 128_000,
  ollama: 8_000,
  lmstudio: 8_000,
};

interface OpenAIMessage {
  role: "system" | "user" | "assistant" | "tool";
  content?: string | null;
  tool_calls?: OpenAIToolCall[];
  tool_call_id?: string;
}

interface OpenAIToolCall {
  id: string;
  type: "function";
  function: { name: string; arguments: string };
}

interface OpenAITool {
  type: "function";
  function: {
    name: string;
    description: string;
    parameters: Record<string, unknown>;
  };
}

export class OpenAICompatProvider implements LlmProvider {
  providerName: string;
  model: string;
  contextWindow: number;
  private baseUrl: string;
  private apiKey: string;
  private maxTokens: number;
  private streaming: boolean;

  constructor(opts: OpenAICompatOptions) {
    this.providerName = opts.name;
    this.baseUrl = opts.baseUrl.replace(/\/+$/, "");
    this.apiKey = opts.apiKey;
    this.model = opts.model;
    this.maxTokens = opts.maxTokens ?? 4096;
    this.streaming = opts.streaming ?? true;
    this.contextWindow =
      opts.contextWindow ?? DEFAULT_CONTEXT_WINDOWS[opts.name] ?? 32_000;
  }

  async chat(request: LlmRequest): Promise<LlmResponse> {
    logger.debug(`${this.providerName} request`, {
      model: this.model,
      messageCount: request.messages.length,
      toolCount: request.tools?.length ?? 0,
    });

    const messages = this.convertMessages(request.system, request.messages);
    const tools = request.tools?.length
      ? this.convertTools(request.tools)
      : undefined;

    const body: Record<string, unknown> = {
      model: this.model,
      messages,
      max_tokens: request.maxTokens ?? this.maxTokens,
      stream: false,
    };
    if (tools) body.tools = tools;

    const res = await fetch(`${this.baseUrl}/chat/completions`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${this.apiKey}`,
      },
      body: JSON.stringify(body),
    });

    if (!res.ok) {
      const text = await res.text();
      throw new Error(
        `${this.providerName} API error ${res.status}: ${text}`
      );
    }

    const json = (await res.json()) as any;
    const choice = json.choices?.[0];
    if (!choice) {
      throw new Error(`${this.providerName}: no choices in response`);
    }

    const content = this.parseChoice(choice);
    const stopReason = this.mapStopReason(choice.finish_reason);

    return {
      content,
      stopReason,
      usage: {
        inputTokens: json.usage?.prompt_tokens ?? 0,
        outputTokens: json.usage?.completion_tokens ?? 0,
      },
    };
  }

  private convertMessages(
    system: string,
    messages: LlmRequest["messages"]
  ): OpenAIMessage[] {
    const out: OpenAIMessage[] = [{ role: "system", content: system }];

    for (const msg of messages) {
      if (typeof msg.content === "string") {
        out.push({ role: msg.role, content: msg.content });
        continue;
      }

      // Multi-block message (tool_use / tool_result / text mix)
      if (msg.role === "assistant") {
        const textParts: string[] = [];
        const toolCalls: OpenAIToolCall[] = [];

        for (const block of msg.content) {
          if (block.type === "text" && block.text) {
            textParts.push(block.text);
          } else if (block.type === "tool_use") {
            toolCalls.push({
              id: block.id!,
              type: "function",
              function: {
                name: block.name!,
                arguments: JSON.stringify(block.input ?? {}),
              },
            });
          }
        }

        const assistantMsg: OpenAIMessage = {
          role: "assistant",
          content: textParts.length ? textParts.join("\n") : null,
        };
        if (toolCalls.length) assistantMsg.tool_calls = toolCalls;
        out.push(assistantMsg);
      } else if (msg.role === "user") {
        // User messages may contain tool_result blocks
        const textParts: string[] = [];
        const toolResults: { tool_call_id: string; content: string }[] = [];

        for (const block of msg.content) {
          if (block.type === "text" && block.text) {
            textParts.push(block.text);
          } else if (block.type === "tool_result") {
            toolResults.push({
              tool_call_id: block.tool_use_id!,
              content: block.content || "No output",
            });
          }
        }

        // Emit tool results as separate tool messages
        for (const tr of toolResults) {
          out.push({
            role: "tool",
            tool_call_id: tr.tool_call_id,
            content: tr.content,
          });
        }

        // Emit any text as a user message
        if (textParts.length) {
          out.push({ role: "user", content: textParts.join("\n") });
        }
      }
    }

    return out;
  }

  private convertTools(tools: LlmToolDef[]): OpenAITool[] {
    return tools.map((t) => ({
      type: "function",
      function: {
        name: t.name,
        description: t.description,
        parameters: t.input_schema,
      },
    }));
  }

  private parseChoice(choice: any): LlmContentBlock[] {
    const blocks: LlmContentBlock[] = [];
    const msg = choice.message;

    if (msg.content) {
      blocks.push({ type: "text", text: msg.content });
    }

    if (msg.tool_calls?.length) {
      for (const tc of msg.tool_calls) {
        let input: Record<string, unknown> = {};
        try {
          input = JSON.parse(tc.function.arguments);
        } catch {
          input = { _raw: tc.function.arguments };
        }
        blocks.push({
          type: "tool_use",
          id: tc.id,
          name: tc.function.name,
          input,
        });
      }
    }

    return blocks;
  }

  private mapStopReason(reason: string): string {
    switch (reason) {
      case "stop":
        return "end_turn";
      case "tool_calls":
        return "tool_use";
      case "length":
        return "max_tokens";
      default:
        return reason ?? "end_turn";
    }
  }
}
