import { describe, test, expect, beforeEach } from "bun:test";
import { Database } from "bun:sqlite";

/**
 * The webhook-manage handler calls `getDb()` from the connection module.
 * We mock that module to return an in-memory database so tests are self-contained.
 */

// We need to set up our mock DB *before* importing the handler.
import { mock } from "bun:test";

let testDb: Database;

function createWebhookDb(): Database {
  const db = new Database(":memory:");
  db.run("PRAGMA foreign_keys = ON");

  db.run(`
    CREATE TABLE IF NOT EXISTS webhooks (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL UNIQUE,
      description TEXT,
      secret TEXT,
      active INTEGER NOT NULL DEFAULT 1,
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    )
  `);
  db.run(`
    CREATE TABLE IF NOT EXISTS webhook_events (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      webhook_id TEXT NOT NULL REFERENCES webhooks(id) ON DELETE CASCADE,
      payload TEXT NOT NULL,
      headers TEXT,
      processed INTEGER NOT NULL DEFAULT 0,
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    )
  `);
  db.run(`CREATE INDEX IF NOT EXISTS idx_webhook_events_webhook ON webhook_events(webhook_id)`);

  return db;
}

// Mock the getDb module before importing the handler
mock.module("../src/db/connection", () => ({
  getDb: () => testDb,
}));

// Import the handler AFTER mocking
const { default: webhookHandler } = await import(
  "../src/tools/builtin-skills/webhook-manage/handler"
);

// ─── Create ──────────────────────────────────────────────────────────────────

describe("webhook-manage: create", () => {
  beforeEach(() => {
    testDb = createWebhookDb();
  });

  test("creates a new webhook", async () => {
    const raw = await webhookHandler({ action: "create", name: "my-hook", description: "test hook" });
    const result = JSON.parse(raw);

    expect(result.action).toBe("create");
    expect(result.webhook.name).toBe("my-hook");
    expect(result.webhook.description).toBe("test hook");
    expect(result.webhook.active).toBe(true);
    expect(result.url).toContain("/api/webhook/");
    expect(result.webhook.id).toBeTruthy();
  });

  test("stores webhook in the database", async () => {
    await webhookHandler({ action: "create", name: "stored-hook" });
    const row = testDb.query("SELECT * FROM webhooks WHERE name = 'stored-hook'").get() as any;
    expect(row).not.toBeNull();
    expect(row.active).toBe(1);
  });

  test("throws when name is missing", async () => {
    expect(webhookHandler({ action: "create" })).rejects.toThrow("'name' is required");
  });

  test("throws on invalid name characters", async () => {
    expect(webhookHandler({ action: "create", name: "bad name!" })).rejects.toThrow("alphanumeric");
  });

  test("throws on duplicate name", async () => {
    await webhookHandler({ action: "create", name: "dup-hook" });
    expect(webhookHandler({ action: "create", name: "dup-hook" })).rejects.toThrow("already exists");
  });

  test("accepts name with hyphens and underscores", async () => {
    const raw = await webhookHandler({ action: "create", name: "my_hook-v2" });
    const result = JSON.parse(raw);
    expect(result.webhook.name).toBe("my_hook-v2");
  });

  test("stores secret when provided", async () => {
    await webhookHandler({ action: "create", name: "secret-hook", secret: "s3cret" });
    const row = testDb.query("SELECT secret FROM webhooks WHERE name = 'secret-hook'").get() as any;
    expect(row.secret).toBe("s3cret");
  });
});

// ─── List ────────────────────────────────────────────────────────────────────

describe("webhook-manage: list", () => {
  beforeEach(() => {
    testDb = createWebhookDb();
  });

  test("lists empty webhooks", async () => {
    const raw = await webhookHandler({ action: "list" });
    const result = JSON.parse(raw);
    expect(result.action).toBe("list");
    expect(result.webhooks).toHaveLength(0);
  });

  test("lists created webhooks", async () => {
    await webhookHandler({ action: "create", name: "hook-a" });
    await webhookHandler({ action: "create", name: "hook-b" });

    const raw = await webhookHandler({ action: "list" });
    const result = JSON.parse(raw);
    expect(result.webhooks).toHaveLength(2);
  });

  test("includes event count per webhook", async () => {
    await webhookHandler({ action: "create", name: "counted-hook" });
    const row = testDb.query("SELECT id FROM webhooks WHERE name = 'counted-hook'").get() as any;

    // Insert some events
    testDb.prepare("INSERT INTO webhook_events (webhook_id, payload) VALUES (?, ?)").run(row.id, '{"test":1}');
    testDb.prepare("INSERT INTO webhook_events (webhook_id, payload) VALUES (?, ?)").run(row.id, '{"test":2}');

    const raw = await webhookHandler({ action: "list" });
    const result = JSON.parse(raw);
    const hook = result.webhooks.find((w: any) => w.name === "counted-hook");
    expect(hook.eventCount).toBe(2);
  });

  test("active field is boolean in output", async () => {
    await webhookHandler({ action: "create", name: "bool-hook" });

    const raw = await webhookHandler({ action: "list" });
    const result = JSON.parse(raw);
    const hook = result.webhooks[0];
    expect(typeof hook.active).toBe("boolean");
    expect(hook.active).toBe(true);
  });
});

// ─── Toggle ──────────────────────────────────────────────────────────────────

describe("webhook-manage: toggle", () => {
  beforeEach(() => {
    testDb = createWebhookDb();
  });

  test("toggles active to false", async () => {
    await webhookHandler({ action: "create", name: "toggle-hook" });
    const raw = await webhookHandler({ action: "toggle", name: "toggle-hook" });
    const result = JSON.parse(raw);

    expect(result.action).toBe("toggle");
    expect(result.active).toBe(false);
  });

  test("toggles back to true", async () => {
    await webhookHandler({ action: "create", name: "toggle-hook" });
    await webhookHandler({ action: "toggle", name: "toggle-hook" }); // active -> false
    const raw = await webhookHandler({ action: "toggle", name: "toggle-hook" }); // active -> true
    const result = JSON.parse(raw);
    expect(result.active).toBe(true);
  });

  test("throws when name is missing", async () => {
    expect(webhookHandler({ action: "toggle" })).rejects.toThrow("'name' is required");
  });

  test("throws for non-existent webhook", async () => {
    expect(webhookHandler({ action: "toggle", name: "ghost" })).rejects.toThrow("not found");
  });
});

// ─── Delete ──────────────────────────────────────────────────────────────────

describe("webhook-manage: delete", () => {
  beforeEach(() => {
    testDb = createWebhookDb();
  });

  test("deletes an existing webhook", async () => {
    await webhookHandler({ action: "create", name: "del-hook" });
    const raw = await webhookHandler({ action: "delete", name: "del-hook" });
    const result = JSON.parse(raw);

    expect(result.action).toBe("delete");
    expect(result.deleted).toBe(true);

    const row = testDb.query("SELECT * FROM webhooks WHERE name = 'del-hook'").get();
    expect(row).toBeNull();
  });

  test("deletes associated events", async () => {
    await webhookHandler({ action: "create", name: "event-hook" });
    const row = testDb.query("SELECT id FROM webhooks WHERE name = 'event-hook'").get() as any;
    testDb.prepare("INSERT INTO webhook_events (webhook_id, payload) VALUES (?, ?)").run(row.id, '{}');

    await webhookHandler({ action: "delete", name: "event-hook" });
    const events = testDb.query("SELECT COUNT(*) as c FROM webhook_events").get() as { c: number };
    expect(events.c).toBe(0);
  });

  test("throws when name is missing", async () => {
    expect(webhookHandler({ action: "delete" })).rejects.toThrow("'name' is required");
  });

  test("throws for non-existent webhook", async () => {
    expect(webhookHandler({ action: "delete", name: "ghost" })).rejects.toThrow("not found");
  });
});

// ─── Unknown action ──────────────────────────────────────────────────────────

describe("webhook-manage: unknown action", () => {
  beforeEach(() => {
    testDb = createWebhookDb();
  });

  test("throws for unknown action", async () => {
    expect(webhookHandler({ action: "nope" })).rejects.toThrow('Unknown action: "nope"');
  });
});
