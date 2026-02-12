import { describe, it, expect } from "bun:test";
import { createMockLlm, textResponse } from "./helpers/mock-llm";
import { createTestDb } from "./helpers/test-db";

describe("Router", () => {
  it("should create a router without errors", async () => {
    const { createRouter } = await import("../src/channels/router");
    const llm = createMockLlm([textResponse("hello")]);
    const db = createTestDb();
    const router = createRouter(llm, db);
    expect(router).toBeDefined();
    expect(router.handleMessage).toBeDefined();
    expect(router.sendProactive).toBeDefined();
    expect(router.addAdapter).toBeDefined();
    db.close();
  });

  it("should support adding adapters", async () => {
    const { createRouter } = await import("../src/channels/router");
    const llm = createMockLlm([textResponse("test")]);
    const db = createTestDb();
    const router = createRouter(llm, db);

    const mockAdapter = {
      channelName: "test",
      start() {},
      stop() {},
      async sendMessage() {},
    };

    router.addAdapter(mockAdapter);
    // Should not throw
    expect(true).toBe(true);
    db.close();
  });
});
