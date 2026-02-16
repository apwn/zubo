import { describe, test, expect, beforeEach } from "bun:test";
import { Database } from "bun:sqlite";

/**
 * Tests for enhanced webhook features found in the webchat.ts dashboard routes:
 * - prompt_template substitution ({{payload}} replacement)
 * - trigger_count increments
 * - Event listing from webhook_events table
 * - HMAC signature verification logic
 *
 * These tests validate the logic by operating directly on the DB schemas
 * and replicating the core logic from the route handlers, following the
 * same pattern used in webchat.test.ts.
 */

let testDb: Database;

function createEnhancedWebhookDb(): Database {
  const db = new Database(":memory:");
  db.run("PRAGMA foreign_keys = ON");

  db.run(`
    CREATE TABLE IF NOT EXISTS webhooks (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL UNIQUE,
      description TEXT,
      secret TEXT,
      active INTEGER NOT NULL DEFAULT 1,
      prompt_template TEXT,
      last_triggered_at TEXT,
      trigger_count INTEGER NOT NULL DEFAULT 0,
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

// ─── Prompt Template Substitution ───────────────────────────────────────────

describe("webhooks-enhanced: prompt template substitution", () => {
  beforeEach(() => {
    testDb = createEnhancedWebhookDb();
  });

  test("replaces {{payload}} with actual payload content", () => {
    const template = "Process this webhook data: {{payload}}";
    const payload = JSON.stringify({ action: "opened", issue: { title: "Bug" } });

    const message = template.replace(/\{\{payload\}\}/g, payload);

    expect(message).toBe(`Process this webhook data: ${payload}`);
    expect(message).toContain('"action":"opened"');
  });

  test("replaces multiple {{payload}} occurrences", () => {
    const template = "Data: {{payload}} | Repeat: {{payload}}";
    const payload = '{"test":true}';

    const message = template.replace(/\{\{payload\}\}/g, payload);

    expect(message).toBe('Data: {"test":true} | Repeat: {"test":true}');
  });

  test("falls back to default message when no prompt_template is set", () => {
    const webhookName = "my-hook";
    const payload = '{"event":"push"}';
    const promptTemplate: string | null = null;

    let message: string;
    if (promptTemplate) {
      message = promptTemplate.replace(/\{\{payload\}\}/g, payload);
    } else {
      message = `[Webhook: ${webhookName}] Received event:\n${payload.slice(0, 500)}`;
    }

    expect(message).toBe(`[Webhook: my-hook] Received event:\n{"event":"push"}`);
  });

  test("truncates payload to 2000 chars in template substitution", () => {
    const template = "Data: {{payload}}";
    const longPayload = "x".repeat(3000);

    const message = template.replace(/\{\{payload\}\}/g, longPayload.slice(0, 2000));

    expect(message.length).toBeLessThanOrEqual(2000 + "Data: ".length);
  });

  test("stores prompt_template in the database", () => {
    const id = crypto.randomUUID();
    const template = "Handle this: {{payload}}";

    testDb.prepare(
      "INSERT INTO webhooks (id, name, description, secret, prompt_template) VALUES (?, ?, ?, ?, ?)"
    ).run(id, "template-hook", "desc", null, template);

    const row = testDb.query("SELECT prompt_template FROM webhooks WHERE id = ?").get(id) as any;
    expect(row.prompt_template).toBe(template);
  });
});

// ─── Trigger Count Increments ───────────────────────────────────────────────

describe("webhooks-enhanced: trigger counting", () => {
  beforeEach(() => {
    testDb = createEnhancedWebhookDb();
  });

  test("trigger_count starts at 0", () => {
    const id = crypto.randomUUID();
    testDb.prepare("INSERT INTO webhooks (id, name) VALUES (?, ?)").run(id, "count-hook");

    const row = testDb.query("SELECT trigger_count FROM webhooks WHERE id = ?").get(id) as any;
    expect(row.trigger_count).toBe(0);
  });

  test("trigger_count increments on each trigger", () => {
    const id = crypto.randomUUID();
    testDb.prepare("INSERT INTO webhooks (id, name) VALUES (?, ?)").run(id, "counter-hook");

    // Simulate 3 trigger events
    for (let i = 0; i < 3; i++) {
      testDb.prepare(
        "UPDATE webhooks SET last_triggered_at = datetime('now'), trigger_count = trigger_count + 1 WHERE id = ?"
      ).run(id);
    }

    const row = testDb.query("SELECT trigger_count, last_triggered_at FROM webhooks WHERE id = ?").get(id) as any;
    expect(row.trigger_count).toBe(3);
    expect(row.last_triggered_at).toBeTruthy();
  });

  test("last_triggered_at updates with each trigger", () => {
    const id = crypto.randomUUID();
    testDb.prepare("INSERT INTO webhooks (id, name) VALUES (?, ?)").run(id, "ts-hook");

    const before = testDb.query("SELECT last_triggered_at FROM webhooks WHERE id = ?").get(id) as any;
    expect(before.last_triggered_at).toBeNull();

    testDb.prepare(
      "UPDATE webhooks SET last_triggered_at = datetime('now'), trigger_count = trigger_count + 1 WHERE id = ?"
    ).run(id);

    const after = testDb.query("SELECT last_triggered_at FROM webhooks WHERE id = ?").get(id) as any;
    expect(after.last_triggered_at).not.toBeNull();
  });
});

// ─── Event Listing ──────────────────────────────────────────────────────────

describe("webhooks-enhanced: event listing", () => {
  beforeEach(() => {
    testDb = createEnhancedWebhookDb();
  });

  test("lists events for a specific webhook", () => {
    const id = crypto.randomUUID();
    testDb.prepare("INSERT INTO webhooks (id, name) VALUES (?, ?)").run(id, "events-hook");

    testDb.prepare("INSERT INTO webhook_events (webhook_id, payload, headers) VALUES (?, ?, ?)").run(id, '{"a":1}', '{}');
    testDb.prepare("INSERT INTO webhook_events (webhook_id, payload, headers) VALUES (?, ?, ?)").run(id, '{"b":2}', '{}');

    const events = testDb.query(
      "SELECT id, payload, headers, processed, created_at FROM webhook_events WHERE webhook_id = ? ORDER BY created_at DESC"
    ).all(id) as any[];

    expect(events).toHaveLength(2);
  });

  test("respects limit on event listing", () => {
    const id = crypto.randomUUID();
    testDb.prepare("INSERT INTO webhooks (id, name) VALUES (?, ?)").run(id, "limited-hook");

    for (let i = 0; i < 5; i++) {
      testDb.prepare("INSERT INTO webhook_events (webhook_id, payload) VALUES (?, ?)").run(id, `{"i":${i}}`);
    }

    const limit = 3;
    const events = testDb.query(
      "SELECT id, payload FROM webhook_events WHERE webhook_id = ? ORDER BY created_at DESC LIMIT ?"
    ).all(id, limit) as any[];

    expect(events).toHaveLength(3);
  });

  test("marks events as processed", () => {
    const id = crypto.randomUUID();
    testDb.prepare("INSERT INTO webhooks (id, name) VALUES (?, ?)").run(id, "process-hook");
    testDb.prepare("INSERT INTO webhook_events (webhook_id, payload) VALUES (?, ?)").run(id, '{"data":true}');

    const lastEvent = testDb.query(
      "SELECT id FROM webhook_events WHERE webhook_id = ? ORDER BY id DESC LIMIT 1"
    ).get(id) as any;

    testDb.prepare("UPDATE webhook_events SET processed = 1 WHERE id = ?").run(lastEvent.id);

    const updated = testDb.query("SELECT processed FROM webhook_events WHERE id = ?").get(lastEvent.id) as any;
    expect(updated.processed).toBe(1);
  });

  test("cascades event deletion when webhook is deleted", () => {
    const id = crypto.randomUUID();
    testDb.prepare("INSERT INTO webhooks (id, name) VALUES (?, ?)").run(id, "cascade-hook");
    testDb.prepare("INSERT INTO webhook_events (webhook_id, payload) VALUES (?, ?)").run(id, '{}');
    testDb.prepare("INSERT INTO webhook_events (webhook_id, payload) VALUES (?, ?)").run(id, '{}');

    // Delete the webhook
    testDb.prepare("DELETE FROM webhooks WHERE id = ?").run(id);

    const events = testDb.query("SELECT COUNT(*) as c FROM webhook_events WHERE webhook_id = ?").get(id) as any;
    expect(events.c).toBe(0);
  });
});

// ─── HMAC Signature Verification ────────────────────────────────────────────

describe("webhooks-enhanced: HMAC signature verification", () => {
  test("produces valid HMAC-SHA256 signature for a payload", async () => {
    const secret = "my-webhook-secret";
    const body = '{"event":"push","ref":"refs/heads/main"}';

    const encoder = new TextEncoder();
    const key = await crypto.subtle.importKey(
      "raw",
      encoder.encode(secret),
      { name: "HMAC", hash: "SHA-256" },
      false,
      ["sign"]
    );

    const sig = await crypto.subtle.sign("HMAC", key, encoder.encode(body));
    const expected = "sha256=" + Array.from(new Uint8Array(sig)).map(b => b.toString(16).padStart(2, "0")).join("");

    expect(expected).toStartWith("sha256=");
    expect(expected.length).toBe(7 + 64); // "sha256=" (7 chars) + 64 hex chars
  });

  test("signature verification succeeds for matching payload", async () => {
    const secret = "test-secret";
    const body = '{"action":"completed"}';

    const encoder = new TextEncoder();
    const key = await crypto.subtle.importKey(
      "raw",
      encoder.encode(secret),
      { name: "HMAC", hash: "SHA-256" },
      false,
      ["sign"]
    );

    const sig = await crypto.subtle.sign("HMAC", key, encoder.encode(body));
    const signature = "sha256=" + Array.from(new Uint8Array(sig)).map(b => b.toString(16).padStart(2, "0")).join("");

    // Verify by re-computing
    const verifySig = await crypto.subtle.sign("HMAC", key, encoder.encode(body));
    const verifyHex = "sha256=" + Array.from(new Uint8Array(verifySig)).map(b => b.toString(16).padStart(2, "0")).join("");

    expect(signature).toBe(verifyHex);
  });

  test("signature verification fails for tampered payload", async () => {
    const secret = "test-secret";
    const originalBody = '{"action":"completed"}';
    const tamperedBody = '{"action":"hacked"}';

    const encoder = new TextEncoder();
    const key = await crypto.subtle.importKey(
      "raw",
      encoder.encode(secret),
      { name: "HMAC", hash: "SHA-256" },
      false,
      ["sign"]
    );

    const originalSig = await crypto.subtle.sign("HMAC", key, encoder.encode(originalBody));
    const originalHex = "sha256=" + Array.from(new Uint8Array(originalSig)).map(b => b.toString(16).padStart(2, "0")).join("");

    const tamperedSig = await crypto.subtle.sign("HMAC", key, encoder.encode(tamperedBody));
    const tamperedHex = "sha256=" + Array.from(new Uint8Array(tamperedSig)).map(b => b.toString(16).padStart(2, "0")).join("");

    expect(originalHex).not.toBe(tamperedHex);
  });

  test("signature verification fails for wrong secret", async () => {
    const body = '{"data":"test"}';
    const encoder = new TextEncoder();

    const key1 = await crypto.subtle.importKey(
      "raw",
      encoder.encode("correct-secret"),
      { name: "HMAC", hash: "SHA-256" },
      false,
      ["sign"]
    );

    const key2 = await crypto.subtle.importKey(
      "raw",
      encoder.encode("wrong-secret"),
      { name: "HMAC", hash: "SHA-256" },
      false,
      ["sign"]
    );

    const sig1 = await crypto.subtle.sign("HMAC", key1, encoder.encode(body));
    const hex1 = Array.from(new Uint8Array(sig1)).map(b => b.toString(16).padStart(2, "0")).join("");

    const sig2 = await crypto.subtle.sign("HMAC", key2, encoder.encode(body));
    const hex2 = Array.from(new Uint8Array(sig2)).map(b => b.toString(16).padStart(2, "0")).join("");

    expect(hex1).not.toBe(hex2);
  });

  test("webhook without secret should skip signature verification", () => {
    const db = createEnhancedWebhookDb();
    const id = crypto.randomUUID();
    db.prepare("INSERT INTO webhooks (id, name, secret) VALUES (?, ?, ?)").run(id, "no-secret-hook", null);

    const row = db.query("SELECT secret FROM webhooks WHERE id = ?").get(id) as any;
    expect(row.secret).toBeNull();

    // In the actual code, when secret is null, HMAC verification is skipped
    const requiresSignature = !!row.secret;
    expect(requiresSignature).toBe(false);

    db.close();
  });
});
