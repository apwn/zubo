import { describe, it, expect } from "bun:test";
import { estimateTokens, estimateMessagesTokens } from "../src/util/tokens";

describe("estimateTokens", () => {
  it("returns 0 for empty string", () => {
    expect(estimateTokens("")).toBe(0);
  });

  it("estimates ~1 token per 4 chars", () => {
    expect(estimateTokens("hello world!")).toBe(3); // 12 chars / 4
  });

  it("rounds up", () => {
    expect(estimateTokens("hi")).toBe(1); // 2 chars → ceil(0.5) = 1
  });
});

describe("estimateMessagesTokens", () => {
  it("returns 0 for empty array", () => {
    expect(estimateMessagesTokens([])).toBe(0);
  });

  it("sums tokens across messages with overhead", () => {
    const messages = [
      { role: "user", content: "hello" }, // 5 chars → 2 tokens + 4 overhead
      { role: "assistant", content: "hi there" }, // 8 chars → 2 tokens + 4 overhead
    ];
    expect(estimateMessagesTokens(messages)).toBe(12);
  });
});
