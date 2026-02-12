import { describe, it, expect } from "bun:test";
import { estimateCost } from "../src/util/costs";

describe("Cost Estimation", () => {
  it("should estimate cost for known models", () => {
    const cost = estimateCost("gpt-4o", 1000, 500);
    expect(cost).toBeGreaterThan(0);
  });

  it("should return 0 for unknown/local models", () => {
    const cost = estimateCost("llama3:latest", 1000, 500);
    expect(cost).toBe(0);
  });

  it("should handle zero tokens", () => {
    const cost = estimateCost("gpt-4o", 0, 0);
    expect(cost).toBe(0);
  });
});
