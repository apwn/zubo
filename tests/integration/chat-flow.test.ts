import { describe, it, expect } from "bun:test";
import { createMockLlm, textResponse, toolCallResponse } from "../helpers/mock-llm";

describe("Integration: Chat Flow", () => {
  it("should handle a full conversation with tool use", async () => {
    const llm = createMockLlm([
      toolCallResponse("datetime", "t1", {}),
      textResponse("The current time is 2025-01-01T12:00:00Z"),
    ]);

    // Simulate the conversation
    const response1 = await llm.chat({ system: "You are Zubo", messages: [{ role: "user", content: "What time is it?" }] });
    expect(response1.stopReason).toBe("tool_use");
    expect(response1.content[0].name).toBe("datetime");

    // After tool execution
    const response2 = await llm.chat({
      system: "You are Zubo",
      messages: [
        { role: "user", content: "What time is it?" },
        { role: "assistant", content: response1.content },
        { role: "user", content: [{ type: "tool_result", tool_use_id: "t1", content: "2025-01-01T12:00:00Z" }] },
      ],
    });
    expect(response2.stopReason).toBe("end_turn");
    expect(response2.content[0].text).toContain("current time");
  });

  it("should handle multi-turn conversation", async () => {
    const llm = createMockLlm([
      textResponse("Hello! I'm Zubo."),
      textResponse("My name is Zubo, and I'm your AI agent."),
    ]);

    const r1 = await llm.chat({ system: "You are Zubo", messages: [{ role: "user", content: "Hi" }] });
    expect(r1.content[0].text).toContain("Zubo");

    const r2 = await llm.chat({
      system: "You are Zubo",
      messages: [
        { role: "user", content: "Hi" },
        { role: "assistant", content: r1.content },
        { role: "user", content: "What's your name?" },
      ],
    });
    expect(r2.content[0].text).toContain("Zubo");
  });
});
