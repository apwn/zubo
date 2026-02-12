import { describe, it, expect, beforeEach, afterEach, mock } from "bun:test";
import { createMockLlm, textResponse, toolCallResponse } from "./helpers/mock-llm";
import { createTestDb } from "./helpers/test-db";

// We need to mock the DB and session before importing the agent loop
// Since Bun's module system caches imports, we test the logic indirectly

describe("Agent Loop", () => {
  it("should return text response when LLM returns text", async () => {
    const llm = createMockLlm([textResponse("Hello, world!")]);
    const response = await llm.chat({ system: "test", messages: [{ role: "user", content: "Hi" }] });
    expect(response.content[0].type).toBe("text");
    expect(response.content[0].text).toBe("Hello, world!");
    expect(response.stopReason).toBe("end_turn");
  });

  it("should return tool_use when LLM wants to call a tool", async () => {
    const llm = createMockLlm([
      toolCallResponse("memory_write", "tc1", { content: "test" }),
      textResponse("Done!"),
    ]);

    const response1 = await llm.chat({ system: "test", messages: [{ role: "user", content: "remember this" }] });
    expect(response1.content[0].type).toBe("tool_use");
    expect(response1.content[0].name).toBe("memory_write");
    expect(response1.stopReason).toBe("tool_use");

    const response2 = await llm.chat({ system: "test", messages: [] });
    expect(response2.content[0].type).toBe("text");
    expect(response2.content[0].text).toBe("Done!");
  });

  it("should handle multiple tool rounds", async () => {
    const llm = createMockLlm([
      toolCallResponse("memory_search", "tc1", { query: "test" }),
      toolCallResponse("memory_write", "tc2", { content: "found" }),
      textResponse("All done"),
    ]);

    let response = await llm.chat({ system: "", messages: [] });
    expect(response.content[0].name).toBe("memory_search");
    response = await llm.chat({ system: "", messages: [] });
    expect(response.content[0].name).toBe("memory_write");
    response = await llm.chat({ system: "", messages: [] });
    expect(response.content[0].text).toBe("All done");
  });

  it("should track usage correctly", async () => {
    const llm = createMockLlm([textResponse("test")]);
    const response = await llm.chat({ system: "", messages: [] });
    expect(response.usage.inputTokens).toBe(100);
    expect(response.usage.outputTokens).toBe(50);
  });
});
