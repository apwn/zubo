import { describe, test, expect, beforeEach } from "bun:test";
import { Database } from "bun:sqlite";
import { mock } from "bun:test";

let testDb: Database;

/**
 * Create an in-memory SQLite database with the tables required by digest.ts.
 */
function createDigestDb(): Database {
  const db = new Database(":memory:");

  // email_digest_config
  db.run(`
    CREATE TABLE IF NOT EXISTS email_digest_config (
      id INTEGER PRIMARY KEY CHECK (id = 1),
      enabled INTEGER NOT NULL DEFAULT 0,
      frequency TEXT NOT NULL DEFAULT 'daily',
      send_time TEXT NOT NULL DEFAULT '09:00',
      email_to TEXT,
      include_conversations INTEGER NOT NULL DEFAULT 1,
      include_tool_usage INTEGER NOT NULL DEFAULT 1,
      include_errors INTEGER NOT NULL DEFAULT 1,
      include_scheduled_tasks INTEGER NOT NULL DEFAULT 1,
      last_sent_at TEXT
    )
  `);
  db.run("INSERT OR IGNORE INTO email_digest_config (id) VALUES (1)");

  // conversation_messages
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

  // tool_metrics
  db.run(`
    CREATE TABLE IF NOT EXISTS tool_metrics (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      tool_name TEXT NOT NULL,
      session_id TEXT,
      duration_ms INTEGER,
      success INTEGER NOT NULL DEFAULT 1,
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    )
  `);

  // cron_logs
  db.run(`
    CREATE TABLE IF NOT EXISTS cron_logs (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      job_id INTEGER NOT NULL,
      status TEXT NOT NULL,
      output TEXT,
      error TEXT,
      started_at TEXT NOT NULL DEFAULT (datetime('now')),
      finished_at TEXT
    )
  `);

  return db;
}

// Mock dependencies before importing the module under test
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

mock.module("../src/util/error-buffer", () => ({
  getRecentErrors: (limit: number) => [],
  recordError: () => {},
  clearErrors: () => {},
}));

mock.module("../src/config/paths", () => ({
  paths: {
    config: "/tmp/zubo-test-config.json",
    dataDir: "/tmp/zubo-test",
    sessions: "/tmp/zubo-test/sessions",
    pidFile: "/tmp/zubo-test/pid",
  },
}));

const { generateDigest, sendDigest } = await import("../src/scheduler/digest");

// ─── generateDigest ─────────────────────────────────────────────────────────

describe("digest: generateDigest", () => {
  beforeEach(() => {
    testDb = createDigestDb();
  });

  test("produces valid HTML with doctype and structure", () => {
    const since = new Date(Date.now() - 24 * 60 * 60 * 1000);
    const html = generateDigest(since);

    expect(html).toContain("<!DOCTYPE html>");
    expect(html).toContain("<html>");
    expect(html).toContain("</html>");
    expect(html).toContain("Zubo Digest");
  });

  test("includes Conversations section when no messages exist", () => {
    const since = new Date(Date.now() - 24 * 60 * 60 * 1000);
    const html = generateDigest(since);

    expect(html).toContain("Conversations");
    expect(html).toContain("No conversations in this period");
  });

  test("includes conversation data when messages exist", () => {
    const since = new Date(Date.now() - 24 * 60 * 60 * 1000);

    testDb.prepare(
      "INSERT INTO conversation_messages (thread_id, role, content, channel, timestamp) VALUES (?, ?, ?, ?, datetime('now'))"
    ).run("t1", "user", "Hello from digest test", "webchat");
    testDb.prepare(
      "INSERT INTO conversation_messages (thread_id, role, content, channel, timestamp) VALUES (?, ?, ?, ?, datetime('now'))"
    ).run("t1", "assistant", "Reply from assistant", "webchat");

    const html = generateDigest(since);

    expect(html).toContain("Conversations");
    expect(html).toContain("2 message(s)");
    expect(html).toContain("Hello from digest test");
  });

  test("includes Tool Usage section", () => {
    const since = new Date(Date.now() - 24 * 60 * 60 * 1000);

    testDb.prepare(
      "INSERT INTO tool_metrics (tool_name, session_id, duration_ms, success, created_at) VALUES (?, ?, ?, ?, datetime('now'))"
    ).run("web-search", "sess-1", 500, 1);
    testDb.prepare(
      "INSERT INTO tool_metrics (tool_name, session_id, duration_ms, success, created_at) VALUES (?, ?, ?, ?, datetime('now'))"
    ).run("web-search", "sess-1", 300, 1);

    const html = generateDigest(since);

    expect(html).toContain("Tool Usage");
    expect(html).toContain("web-search");
  });

  test("includes Scheduled Tasks section with cron logs", () => {
    const since = new Date(Date.now() - 24 * 60 * 60 * 1000);

    testDb.prepare(
      "INSERT INTO cron_logs (job_id, status, output, started_at) VALUES (?, ?, ?, datetime('now'))"
    ).run(1, "success", "Completed successfully");

    const html = generateDigest(since);

    expect(html).toContain("Scheduled Tasks");
    expect(html).toContain("success");
  });

  test("includes Recent Errors section", () => {
    const since = new Date(Date.now() - 24 * 60 * 60 * 1000);
    const html = generateDigest(since);

    expect(html).toContain("Recent Errors");
  });

  test("includes footer with generation timestamp", () => {
    const since = new Date(Date.now() - 24 * 60 * 60 * 1000);
    const html = generateDigest(since);

    expect(html).toContain("Generated by Zubo");
  });

  test("escapes HTML in message content to prevent XSS", () => {
    const since = new Date(Date.now() - 24 * 60 * 60 * 1000);

    testDb.prepare(
      "INSERT INTO conversation_messages (thread_id, role, content, channel, timestamp) VALUES (?, ?, ?, ?, datetime('now'))"
    ).run("t1", "user", "<script>alert('xss')</script>", "webchat");

    const html = generateDigest(since);

    expect(html).not.toContain("<script>");
    expect(html).toContain("&lt;script&gt;");
  });
});

// ─── Config validation ──────────────────────────────────────────────────────

describe("digest: config validation", () => {
  beforeEach(() => {
    testDb = createDigestDb();
  });

  test("respects include_conversations = 0 config", () => {
    testDb.prepare(
      "UPDATE email_digest_config SET include_conversations = 0, include_tool_usage = 0, include_errors = 0, include_scheduled_tasks = 0 WHERE id = 1"
    ).run();

    const since = new Date(Date.now() - 24 * 60 * 60 * 1000);

    testDb.prepare(
      "INSERT INTO conversation_messages (thread_id, role, content, channel, timestamp) VALUES (?, ?, ?, ?, datetime('now'))"
    ).run("t1", "user", "should not appear", "webchat");

    const html = generateDigest(since);

    // When conversations are disabled, the section should not appear
    expect(html).not.toContain("Conversations");
    expect(html).not.toContain("should not appear");
  });

  test("defaults to all sections enabled when config row is missing", () => {
    // Remove config row
    testDb.run("DELETE FROM email_digest_config");

    const since = new Date(Date.now() - 24 * 60 * 60 * 1000);
    const html = generateDigest(since);

    // All sections should still be present with defaults
    expect(html).toContain("Conversations");
    expect(html).toContain("Tool Usage");
    expect(html).toContain("Recent Errors");
    expect(html).toContain("Scheduled Tasks");
  });

  test("sendDigest returns early when digest is disabled", async () => {
    testDb.prepare("UPDATE email_digest_config SET enabled = 0 WHERE id = 1").run();

    // sendDigest should return without error (no email sent)
    await expect(sendDigest()).resolves.toBeUndefined();
  });

  test("sendDigest returns early when email_to is empty", async () => {
    testDb.prepare("UPDATE email_digest_config SET enabled = 1, email_to = NULL WHERE id = 1").run();

    await expect(sendDigest()).resolves.toBeUndefined();
  });

  test("frequency defaults to daily", () => {
    const config = testDb.query("SELECT frequency FROM email_digest_config WHERE id = 1").get() as any;
    expect(config.frequency).toBe("daily");
  });

  test("send_time defaults to 09:00", () => {
    const config = testDb.query("SELECT send_time FROM email_digest_config WHERE id = 1").get() as any;
    expect(config.send_time).toBe("09:00");
  });
});
