export interface LlmMessage {
  role: "user" | "assistant";
  content: string | LlmContentBlock[];
}

export interface LlmContentBlock {
  type: "text" | "tool_use" | "tool_result";
  text?: string;
  id?: string;
  name?: string;
  input?: Record<string, unknown>;
  tool_use_id?: string;
  content?: string;
  is_error?: boolean;
}

export interface LlmToolDef {
  name: string;
  description: string;
  input_schema: Record<string, unknown>;
}

export interface LlmRequest {
  system: string;
  messages: LlmMessage[];
  tools?: LlmToolDef[];
  maxTokens?: number;
}

export interface LlmResponse {
  content: LlmContentBlock[];
  stopReason: string;
  usage: {
    inputTokens: number;
    outputTokens: number;
    cacheCreationTokens?: number;
    cacheReadTokens?: number;
  };
}

// --- Streaming types ---

export interface LlmStreamEventTextDelta {
  type: "text_delta";
  text: string;
}

export interface LlmStreamEventToolUseStart {
  type: "tool_use_start";
  id: string;
  name: string;
}

export interface LlmStreamEventToolUseDelta {
  type: "tool_use_delta";
  id: string;
  json: string;
}

export interface LlmStreamEventToolUseEnd {
  type: "tool_use_end";
  id: string;
}

export interface LlmStreamEventMessageDone {
  type: "message_done";
  response: LlmResponse;
}

export type LlmStreamEvent =
  | LlmStreamEventTextDelta
  | LlmStreamEventToolUseStart
  | LlmStreamEventToolUseDelta
  | LlmStreamEventToolUseEnd
  | LlmStreamEventMessageDone;

export interface LlmProvider {
  providerName: string;
  model: string;
  contextWindow: number;
  chat(request: LlmRequest): Promise<LlmResponse>;
  chatStream?(request: LlmRequest): AsyncIterable<LlmStreamEvent>;
}
