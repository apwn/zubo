import { describe, it, expect } from "bun:test";
import { compactMessages } from "../src/agent/compaction";
import type { LlmMessage } from "../src/llm/provider";

function makeMessages(count: number, charsEach: number): LlmMessage[] {
  return Array.from({ length: count }, (_, i) => ({
    role: (i % 2 === 0 ? "user" : "assistant") as "user" | "assistant",
    content: "x".repeat(charsEach),
  }));
}

describe("compactMessages", () => {
  it("returns messages unchanged when under limit", () => {
    const msgs = makeMessages(4, 100);
    const result = compactMessages(msgs, 150_000);
    expect(result.length).toBe(4);
  });

  it("trims messages when over context window", () => {
    // 50 messages x 10000 chars each = 500k chars ≈ 125k tokens
    // With contextWindow of 1000 tokens, should compact heavily
    const msgs = makeMessages(50, 10_000);
    const result = compactMessages(msgs, 1_000);
    expect(result.length).toBeLessThan(50);
  });

  it("ensures first message is from user after compaction", () => {
    const msgs = makeMessages(50, 10_000);
    const result = compactMessages(msgs, 1_000);
    expect(result[0].role).toBe("user");
  });

  it("keeps at least 2 messages", () => {
    const msgs = makeMessages(50, 10_000);
    const result = compactMessages(msgs, 1_000);
    expect(result.length).toBeGreaterThanOrEqual(2);
  });

  it("uses default context window when none provided", () => {
    const msgs = makeMessages(4, 100);
    const result = compactMessages(msgs);
    expect(result.length).toBe(4);
  });
});
