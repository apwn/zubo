import { describe, it, expect } from "bun:test";
import { splitMessage } from "../src/channels/utils";

describe("Channel Utilities", () => {
  describe("splitMessage", () => {
    it("should return single chunk for short messages", () => {
      const result = splitMessage("Hello world", 100);
      expect(result).toEqual(["Hello world"]);
    });

    it("should split at newlines when possible", () => {
      const msg = "Line 1\nLine 2\nLine 3";
      const result = splitMessage(msg, 14);
      expect(result.length).toBeGreaterThan(1);
      // Each chunk should be within limit
      for (const chunk of result) {
        expect(chunk.length).toBeLessThanOrEqual(14);
      }
    });

    it("should force-split long lines without newlines", () => {
      const msg = "A".repeat(100);
      const result = splitMessage(msg, 30);
      expect(result.length).toBeGreaterThan(1);
    });

    it("should handle empty string", () => {
      const result = splitMessage("", 100);
      expect(result).toEqual([""]);
    });

    it("should handle exact boundary length", () => {
      const msg = "A".repeat(50);
      const result = splitMessage(msg, 50);
      expect(result).toEqual([msg]);
    });
  });
});

describe("Router", () => {
  it("should export createRouter function", async () => {
    const { createRouter } = await import("../src/channels/router");
    expect(typeof createRouter).toBe("function");
  });

  it("should handle addAdapter and stopAll", async () => {
    const { createRouter } = await import("../src/channels/router");
    const { createMockLlm, textResponse } = await import("./helpers/mock-llm");
    const { createTestDb } = await import("./helpers/test-db");

    const llm = createMockLlm([textResponse("hello")]);
    const db = createTestDb();
    const router = createRouter(llm, db);

    let stopped = false;
    const mockAdapter = {
      channelName: "test",
      start() {},
      stop() { stopped = true; },
      async sendMessage() {},
    };

    router.addAdapter(mockAdapter);
    router.stopAll();
    expect(stopped).toBe(true);
  });
});
