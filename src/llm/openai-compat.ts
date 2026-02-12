import type {
  LlmProvider,
  LlmRequest,
  LlmResponse,
  LlmContentBlock,
  LlmToolDef,
  LlmStreamEvent,
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

  async *chatStream(request: LlmRequest): AsyncIterable<LlmStreamEvent> {
    logger.debug(`${this.providerName} stream request`, {
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
      stream: true,
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
      throw new Error(`${this.providerName} API error ${res.status}: ${text}`);
    }

    if (!res.body) {
      throw new Error(`${this.providerName}: no response body for stream`);
    }

    // Track accumulated state for final message
    let fullText = "";
    const toolCalls = new Map<number, { id: string; name: string; args: string }>();
    let stopReason = "end_turn";
    let promptTokens = 0;
    let completionTokens = 0;

    const reader = res.body.getReader();
    const decoder = new TextDecoder();
    let buffer = "";

    try {
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split("\n");
        buffer = lines.pop() ?? "";

        for (const line of lines) {
          const trimmed = line.trim();
          if (!trimmed || !trimmed.startsWith("data: ")) continue;
          const data = trimmed.slice(6);
          if (data === "[DONE]") continue;

          let parsed: any;
          try { parsed = JSON.parse(data); } catch { continue; }

          if (parsed.usage) {
            promptTokens = parsed.usage.prompt_tokens ?? promptTokens;
            completionTokens = parsed.usage.completion_tokens ?? completionTokens;
          }

          const choice = parsed.choices?.[0];
          if (!choice) continue;

          if (choice.finish_reason) {
            stopReason = this.mapStopReason(choice.finish_reason);
          }

          const delta = choice.delta;
          if (!delta) continue;

          // Text content
          if (delta.content) {
            fullText += delta.content;
            yield { type: "text_delta", text: delta.content };
          }

          // Tool calls
          if (delta.tool_calls) {
            for (const tc of delta.tool_calls) {
              const idx = tc.index ?? 0;
              if (!toolCalls.has(idx)) {
                toolCalls.set(idx, { id: tc.id ?? "", name: tc.function?.name ?? "", args: "" });
                if (tc.id && tc.function?.name) {
                  yield { type: "tool_use_start", id: tc.id, name: tc.function.name };
                }
              }
              const existing = toolCalls.get(idx)!;
              if (tc.id) existing.id = tc.id;
              if (tc.function?.name) existing.name = tc.function.name;
              if (tc.function?.arguments) {
                existing.args += tc.function.arguments;
                yield { type: "tool_use_delta", id: existing.id, json: tc.function.arguments };
              }
            }
          }
        }
      }
    } finally {
      reader.releaseLock();
      // Ensure the response body is fully consumed/cancelled to free resources
      try { await res.body!.cancel(); } catch {}
    }

    // Emit tool_use_end for all tool calls
    for (const [_, tc] of toolCalls) {
      yield { type: "tool_use_end", id: tc.id };
    }

    // Build final content blocks
    const content: LlmContentBlock[] = [];
    if (fullText) {
      content.push({ type: "text", text: fullText });
    }
    for (const [_, tc] of toolCalls) {
      let input: Record<string, unknown> = {};
      try { input = JSON.parse(tc.args); } catch { input = { _raw: tc.args }; }
      content.push({ type: "tool_use", id: tc.id, name: tc.name, input });
    }

    yield {
      type: "message_done",
      response: {
        content,
        stopReason,
        usage: {
          inputTokens: promptTokens,
          outputTokens: completionTokens,
        },
      },
    };
  }
}
