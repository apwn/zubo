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
  usage: { inputTokens: number; outputTokens: number };
}

export interface LlmProvider {
  providerName: string;
  model: string;
  chat(request: LlmRequest): Promise<LlmResponse>;
}
