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

  it("should handle /help command consistently", async () => {
    const { createRouter } = await import("../src/channels/router");
    const llm = createMockLlm([textResponse("should-not-be-called")]);
    const db = createTestDb();
    const router = createRouter(llm, db);

    let replyText = "";
    await router.handleMessage(
      { channel: "webchat", userId: "u1", sessionKey: "webchat:u1", text: "/help" },
      async (text) => {
        replyText = text;
      }
    );

    expect(replyText).toContain("/status");
    expect(replyText).toContain("/memory <query>");
    db.close();
  });

  it("should return memory results for /memory command", async () => {
    const { createRouter } = await import("../src/channels/router");
    const llm = createMockLlm([textResponse("unused")]);
    const db = createTestDb();
    db.run("INSERT INTO memory_chunks (source_file, chunk_index, content) VALUES ('mem.md', 0, 'alice likes espresso')");
    db.run("INSERT INTO memory_fts(rowid, content, source_file) VALUES (1, 'alice likes espresso', 'mem.md')");
    const router = createRouter(llm, db);

    let replyText = "";
    await router.handleMessage(
      { channel: "webchat", userId: "u1", sessionKey: "webchat:u1", text: "/memory alice" },
      async (text) => {
        replyText = text;
      }
    );

    expect(replyText).toContain("Found 1 memory matches");
    expect(replyText).toContain("confidence");
    db.close();
  });

  it("should handle /model and /permissions commands", async () => {
    const { createRouter } = await import("../src/channels/router");
    const llm = createMockLlm([textResponse("unused")]);
    const db = createTestDb();
    const router = createRouter(llm, db);

    let modelReply = "";
    await router.handleMessage(
      { channel: "webchat", userId: "u1", sessionKey: "webchat:u1", text: "/model" },
      async (text) => {
        modelReply = text;
      }
    );
    expect(modelReply).toContain("Current model:");

    let permReply = "";
    await router.handleMessage(
      { channel: "webchat", userId: "u1", sessionKey: "webchat:u1", text: "/permissions shell" },
      async (text) => {
        permReply = text;
      }
    );
    expect(permReply).toContain("level:");
    expect(permReply).toContain("scopes:");
    db.close();
  });

  it("should return sent-message log entries for /sent", async () => {
    const { createRouter } = await import("../src/channels/router");
    const llm = createMockLlm([textResponse("unused")]);
    const db = createTestDb();
    db.prepare(
      "INSERT INTO sent_messages (provider, recipient, subject, status) VALUES (?, ?, ?, ?)"
    ).run("smtp", "nichemkg@gmail.com", "Quick joke 😄", "sent");
    const router = createRouter(llm, db);

    let sentReply = "";
    await router.handleMessage(
      { channel: "webchat", userId: "u1", sessionKey: "webchat:u1", text: "/sent 5" },
      async (text) => {
        sentReply = text;
      }
    );
    expect(sentReply).toContain("nichemkg@gmail.com");
    expect(sentReply).toContain("Quick joke");
    db.close();
  });
});
