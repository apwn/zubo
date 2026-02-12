import type { LlmProvider, LlmRequest, LlmResponse, LlmContentBlock } from "../../src/llm/provider";

export function textResponse(text: string): LlmResponse {
  return {
    content: [{ type: "text", text }],
    stopReason: "end_turn",
    usage: { inputTokens: 100, outputTokens: 50 },
  };
}

export function toolCallResponse(toolName: string, toolId: string, input: Record<string, unknown>): LlmResponse {
  return {
    content: [
      { type: "tool_use", id: toolId, name: toolName, input },
    ],
    stopReason: "tool_use",
    usage: { inputTokens: 100, outputTokens: 50 },
  };
}

export function createMockLlm(responses: LlmResponse[]): LlmProvider {
  let callIndex = 0;
  return {
    providerName: "mock",
    model: "mock-model",
    contextWindow: 100_000,
    async chat(request: LlmRequest): Promise<LlmResponse> {
      if (callIndex >= responses.length) {
        return textResponse("(no more mock responses)");
      }
      return responses[callIndex++];
    },
  };
}
