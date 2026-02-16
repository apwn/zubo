import { describe, test, expect, beforeEach } from "bun:test";
import { Database } from "bun:sqlite";
import { mock } from "bun:test";

let testDb: Database;

/**
 * Create an in-memory SQLite database with the tables required by history.ts:
 * threads, conversation_messages, and the FTS5 virtual table conversation_search.
 */
function createHistoryDb(): Database {
  const db = new Database(":memory:");

  db.run(`
    CREATE TABLE IF NOT EXISTS threads (
      id TEXT PRIMARY KEY,
      title TEXT NOT NULL DEFAULT 'New conversation',
      channel TEXT DEFAULT 'webchat',
      message_count INTEGER DEFAULT 0,
      summary TEXT,
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      updated_at TEXT NOT NULL DEFAULT (datetime('now'))
    )
  `);

  db.run(`
    CREATE TABLE IF NOT EXISTS conversation_messages (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      thread_id TEXT NOT NULL,
      role TEXT NOT NULL,
      content TEXT NOT NULL,
      channel TEXT,
      timestamp TEXT NOT NULL DEFAULT (datetime('now'))
    )
  `);

  db.run(`CREATE INDEX IF NOT EXISTS idx_conv_msg_thread ON conversation_messages(thread_id)`);
  db.run(`CREATE INDEX IF NOT EXISTS idx_conv_msg_ts ON conversation_messages(timestamp DESC)`);

  db.run(`CREATE VIRTUAL TABLE IF NOT EXISTS conversation_search USING fts5(content, thread_id UNINDEXED, role UNINDEXED)`);

  return db;
}

// Mock the DB connection and logger before importing the module under test
mock.module("../src/db/connection", () => ({
  getDb: () => testDb,
}));

mock.module("../src/util/logger", () => ({
  logger: {
    debug: () => {},
    info: () => {},
    warn: () => {},
    error: () => {},
  },
}));

const { recordMessage, searchConversations, getConversationStats } = await import(
  "../src/agent/history"
);

// ─── recordMessage ──────────────────────────────────────────────────────────

describe("history: recordMessage", () => {
  beforeEach(() => {
    testDb = createHistoryDb();
  });

  test("inserts a row into conversation_messages", () => {
    const threadId = "thread-1";
    testDb.prepare("INSERT INTO threads (id, title) VALUES (?, ?)").run(threadId, "Test thread");

    recordMessage(threadId, "user", "Hello world", "webchat");

    const rows = testDb.query("SELECT * FROM conversation_messages WHERE thread_id = ?").all(threadId) as any[];
    expect(rows).toHaveLength(1);
    expect(rows[0].role).toBe("user");
    expect(rows[0].content).toBe("Hello world");
    expect(rows[0].channel).toBe("webchat");
  });

  test("updates thread message_count", () => {
    const threadId = "thread-2";
    testDb.prepare("INSERT INTO threads (id, title) VALUES (?, ?)").run(threadId, "Counter thread");

    recordMessage(threadId, "user", "first message");
    recordMessage(threadId, "assistant", "reply");

    const thread = testDb.query("SELECT message_count FROM threads WHERE id = ?").get(threadId) as any;
    expect(thread.message_count).toBe(2);
  });

  test("indexes content in conversation_search FTS table", () => {
    const threadId = "thread-3";
    testDb.prepare("INSERT INTO threads (id, title) VALUES (?, ?)").run(threadId, "FTS thread");

    recordMessage(threadId, "user", "quantum computing is fascinating");

    const ftsRows = testDb.query("SELECT * FROM conversation_search WHERE conversation_search MATCH 'quantum'").all() as any[];
    expect(ftsRows).toHaveLength(1);
    expect(ftsRows[0].thread_id).toBe(threadId);
    expect(ftsRows[0].role).toBe("user");
  });

  test("handles null channel gracefully", () => {
    const threadId = "thread-4";
    testDb.prepare("INSERT INTO threads (id, title) VALUES (?, ?)").run(threadId, "No channel");

    recordMessage(threadId, "user", "no channel message");

    const row = testDb.query("SELECT channel FROM conversation_messages WHERE thread_id = ?").get(threadId) as any;
    expect(row.channel).toBeNull();
  });

  test("does not throw when thread does not exist (no FK constraint)", () => {
    // recordMessage catches errors internally, so it should not throw
    expect(() => recordMessage("nonexistent-thread", "user", "orphan message")).not.toThrow();
  });
});

// ─── searchConversations ────────────────────────────────────────────────────

describe("history: searchConversations", () => {
  beforeEach(() => {
    testDb = createHistoryDb();
    // Seed some conversations
    const threadId = "search-thread-1";
    testDb.prepare("INSERT INTO threads (id, title) VALUES (?, ?)").run(threadId, "Search thread");

    const msgs = [
      { role: "user", content: "Tell me about machine learning", channel: "webchat" },
      { role: "assistant", content: "Machine learning is a subset of AI", channel: "webchat" },
      { role: "user", content: "What about deep learning neural networks?", channel: "telegram" },
    ];

    for (const m of msgs) {
      testDb.prepare(
        "INSERT INTO conversation_messages (thread_id, role, content, channel, timestamp) VALUES (?, ?, ?, ?, datetime('now'))"
      ).run(threadId, m.role, m.content, m.channel);
      testDb.prepare(
        "INSERT INTO conversation_search (content, thread_id, role) VALUES (?, ?, ?)"
      ).run(m.content, threadId, m.role);
    }
  });

  test("returns matching messages for a valid query", () => {
    const results = searchConversations("machine learning");
    expect(results.length).toBeGreaterThan(0);
    const contents = results.map((r: any) => r.content);
    expect(contents.some((c: string) => c.includes("machine learning") || c.includes("Machine learning"))).toBe(true);
  });

  test("returns empty array for no matches", () => {
    const results = searchConversations("xyzzyflurbo");
    expect(results).toHaveLength(0);
  });

  test("returns empty array for empty query", () => {
    const results = searchConversations("");
    expect(results).toHaveLength(0);
  });

  test("sanitizes FTS5 operators from query", () => {
    // These should not throw or exploit FTS5
    const results = searchConversations('machine" OR DROP TABLE');
    expect(Array.isArray(results)).toBe(true);
  });

  test("respects the limit parameter", () => {
    const results = searchConversations("learning", 1);
    expect(results.length).toBeLessThanOrEqual(1);
  });

  test("returns thread_id and role fields", () => {
    const results = searchConversations("deep learning");
    if (results.length > 0) {
      expect(results[0].thread_id).toBe("search-thread-1");
      expect(typeof results[0].role).toBe("string");
    }
  });
});

// ─── getConversationStats ───────────────────────────────────────────────────

describe("history: getConversationStats", () => {
  beforeEach(() => {
    testDb = createHistoryDb();
  });

  test("returns zero counts for empty database", () => {
    const stats = getConversationStats();
    expect(stats.totalConversations).toBe(0);
    expect(stats.totalMessages).toBe(0);
    expect(stats.messagesByChannel).toHaveLength(0);
    expect(stats.recentActivity).toHaveLength(0);
  });

  test("returns correct totalConversations count", () => {
    testDb.prepare("INSERT INTO threads (id, title) VALUES (?, ?)").run("t1", "Thread 1");
    testDb.prepare("INSERT INTO threads (id, title) VALUES (?, ?)").run("t2", "Thread 2");

    const stats = getConversationStats();
    expect(stats.totalConversations).toBe(2);
  });

  test("returns correct totalMessages count", () => {
    testDb.prepare("INSERT INTO threads (id, title) VALUES (?, ?)").run("t1", "Thread");
    testDb.prepare(
      "INSERT INTO conversation_messages (thread_id, role, content, channel, timestamp) VALUES (?, ?, ?, ?, datetime('now'))"
    ).run("t1", "user", "msg1", "webchat");
    testDb.prepare(
      "INSERT INTO conversation_messages (thread_id, role, content, channel, timestamp) VALUES (?, ?, ?, ?, datetime('now'))"
    ).run("t1", "assistant", "msg2", "webchat");
    testDb.prepare(
      "INSERT INTO conversation_messages (thread_id, role, content, channel, timestamp) VALUES (?, ?, ?, ?, datetime('now'))"
    ).run("t1", "user", "msg3", "telegram");

    const stats = getConversationStats();
    expect(stats.totalMessages).toBe(3);
  });

  test("groups messagesByChannel correctly", () => {
    testDb.prepare("INSERT INTO threads (id, title) VALUES (?, ?)").run("t1", "Thread");
    testDb.prepare(
      "INSERT INTO conversation_messages (thread_id, role, content, channel, timestamp) VALUES (?, ?, ?, ?, datetime('now'))"
    ).run("t1", "user", "a", "webchat");
    testDb.prepare(
      "INSERT INTO conversation_messages (thread_id, role, content, channel, timestamp) VALUES (?, ?, ?, ?, datetime('now'))"
    ).run("t1", "user", "b", "webchat");
    testDb.prepare(
      "INSERT INTO conversation_messages (thread_id, role, content, channel, timestamp) VALUES (?, ?, ?, ?, datetime('now'))"
    ).run("t1", "user", "c", "telegram");

    const stats = getConversationStats();
    expect(stats.messagesByChannel.length).toBeGreaterThanOrEqual(2);

    const webchat = stats.messagesByChannel.find((c: any) => c.channel === "webchat");
    const telegram = stats.messagesByChannel.find((c: any) => c.channel === "telegram");
    expect(webchat?.count).toBe(2);
    expect(telegram?.count).toBe(1);
  });

  test("recentActivity includes today's messages", () => {
    testDb.prepare("INSERT INTO threads (id, title) VALUES (?, ?)").run("t1", "Thread");
    testDb.prepare(
      "INSERT INTO conversation_messages (thread_id, role, content, channel, timestamp) VALUES (?, ?, ?, ?, datetime('now'))"
    ).run("t1", "user", "recent", "webchat");

    const stats = getConversationStats();
    expect(stats.recentActivity.length).toBeGreaterThanOrEqual(1);
    expect(stats.recentActivity[0].count).toBeGreaterThanOrEqual(1);
  });
});
