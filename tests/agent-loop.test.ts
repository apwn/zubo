import { describe, it, expect } from "bun:test";
import { createMockLlm, textResponse, toolCallResponse } from "./helpers/mock-llm";
import { hasEmailSendIntent, canSendEmailWithTools } from "../src/agent/loop";

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

  it("detects send-email intent", () => {
    expect(hasEmailSendIntent("write a mail to nichemkg@gmail.com with a joke")).toBe(true);
    expect(hasEmailSendIntent("send an email to test@example.com")).toBe(true);
    expect(hasEmailSendIntent("draft an email to nichemkg@gmail.com")).toBe(false);
    expect(hasEmailSendIntent("hello there")).toBe(false);
  });

  it("detects available email send tools", () => {
    expect(canSendEmailWithTools([{ name: "email_send" }])).toBe(true);
    expect(canSendEmailWithTools([{ name: "gmail" }])).toBe(true);
    expect(canSendEmailWithTools([{ name: "web_search" }])).toBe(false);
  });
});
