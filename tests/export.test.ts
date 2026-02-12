import { describe, it, expect, beforeEach } from "bun:test";
import { Database } from "bun:sqlite";
import { existsSync, readFileSync, unlinkSync, mkdirSync } from "fs";
import { join } from "path";
import { tmpdir } from "os";
import { exportDatabase, importDatabase, getDbStats, backupDatabase } from "../src/db/export";

function createExportTestDb(): Database {
  const db = new Database(":memory:");

  // Create tables that export uses
  db.run(`CREATE TABLE IF NOT EXISTS sessions (id TEXT PRIMARY KEY, channel TEXT, user_id TEXT, created_at TEXT, updated_at TEXT)`);
  db.run(`CREATE TABLE IF NOT EXISTS messages (id INTEGER PRIMARY KEY, session_id TEXT, role TEXT, content TEXT, created_at TEXT)`);
  db.run(`CREATE TABLE IF NOT EXISTS memory_chunks (id INTEGER PRIMARY KEY, source_file TEXT, chunk_index INTEGER, content TEXT)`);
  db.run(`CREATE TABLE IF NOT EXISTS cron_jobs (id INTEGER PRIMARY KEY, name TEXT, schedule TEXT, task TEXT, enabled INTEGER DEFAULT 1, last_run TEXT, next_run TEXT)`);
  db.run(`CREATE TABLE IF NOT EXISTS usage (id INTEGER PRIMARY KEY, session_id TEXT, provider TEXT, model TEXT, input_tokens INTEGER, output_tokens INTEGER, created_at TEXT)`);
  db.run(`CREATE TABLE IF NOT EXISTS uploads (id INTEGER PRIMARY KEY, filename TEXT, original_name TEXT, mime_type TEXT, size_bytes INTEGER, chunk_count INTEGER)`);

  return db;
}

describe("Database Export", () => {
  let db: Database;
  let tmpDir: string;

  beforeEach(() => {
    db = createExportTestDb();
    tmpDir = join(tmpdir(), `zubo-test-${Date.now()}`);
    mkdirSync(tmpDir, { recursive: true });
  });

  it("should export database as valid JSON", () => {
    // Insert test data
    db.run("INSERT INTO sessions (id, channel, user_id, created_at, updated_at) VALUES ('s1', 'webchat', 'user1', '2024-01-01', '2024-01-01')");
    db.run("INSERT INTO messages (session_id, role, content, created_at) VALUES ('s1', 'user', 'Hello', '2024-01-01')");
    db.run("INSERT INTO memory_chunks (source_file, chunk_index, content) VALUES ('test.md', 0, 'Test memory')");

    const outputPath = join(tmpDir, "export.json");
    exportDatabase(db, outputPath);

    expect(existsSync(outputPath)).toBe(true);

    const data = JSON.parse(readFileSync(outputPath, "utf-8"));
    expect(data.version).toBe(1);
    expect(data.exportedAt).toBeTruthy();
    expect(data.tables.sessions).toHaveLength(1);
    expect(data.tables.messages).toHaveLength(1);
    expect(data.tables.memory_chunks).toHaveLength(1);

    try { unlinkSync(outputPath); } catch {}
  });

  it("should import data from JSON", () => {
    const exportData = {
      version: 1,
      exportedAt: new Date().toISOString(),
      tables: {
        sessions: [{ id: "s1", channel: "webchat", user_id: "user1", created_at: "2024-01-01", updated_at: "2024-01-01" }],
        messages: [{ id: 1, session_id: "s1", role: "user", content: "Hello", created_at: "2024-01-01" }],
      },
    };

    const inputPath = join(tmpDir, "import.json");
    const { writeFileSync } = require("fs");
    writeFileSync(inputPath, JSON.stringify(exportData));

    const result = importDatabase(db, inputPath);
    expect(result.imported).toBeGreaterThan(0);

    // Verify data was imported
    const sessions = db.query("SELECT * FROM sessions").all();
    expect(sessions).toHaveLength(1);

    const messages = db.query("SELECT * FROM messages").all();
    expect(messages).toHaveLength(1);

    try { unlinkSync(inputPath); } catch {}
  });

  it("should skip duplicate rows on import", () => {
    // Insert existing data
    db.run("INSERT INTO sessions (id, channel, user_id, created_at, updated_at) VALUES ('s1', 'webchat', 'user1', '2024-01-01', '2024-01-01')");

    const exportData = {
      version: 1,
      exportedAt: new Date().toISOString(),
      tables: {
        sessions: [{ id: "s1", channel: "webchat", user_id: "user1", created_at: "2024-01-01", updated_at: "2024-01-01" }],
      },
    };

    const inputPath = join(tmpDir, "import-dup.json");
    const { writeFileSync } = require("fs");
    writeFileSync(inputPath, JSON.stringify(exportData));

    const result = importDatabase(db, inputPath);
    // Should have been handled (either imported or skipped, no error)
    expect(result.imported + result.skipped).toBeGreaterThanOrEqual(1);

    // Should still have exactly one session
    const sessions = db.query("SELECT * FROM sessions").all();
    expect(sessions).toHaveLength(1);

    try { unlinkSync(inputPath); } catch {}
  });

  it("should get database stats", () => {
    db.run("INSERT INTO sessions (id, channel, user_id, created_at, updated_at) VALUES ('s1', 'webchat', 'user1', '2024-01-01', '2024-01-01')");
    db.run("INSERT INTO messages (session_id, role, content, created_at) VALUES ('s1', 'user', 'Hello', '2024-01-01')");
    db.run("INSERT INTO messages (session_id, role, content, created_at) VALUES ('s1', 'assistant', 'Hi', '2024-01-01')");

    const stats = getDbStats(db);
    expect(stats.tables.sessions).toBe(1);
    expect(stats.tables.messages).toBe(2);
  });

  it("should create SQLite backup file", () => {
    // Create a real on-disk DB for backup test
    const dbPath = join(tmpDir, "test.db");
    const diskDb = new Database(dbPath, { create: true });
    diskDb.run("CREATE TABLE test (id INTEGER PRIMARY KEY, value TEXT)");
    diskDb.run("INSERT INTO test VALUES (1, 'hello')");
    diskDb.close();

    const backupPath = backupDatabase(dbPath, tmpDir);
    expect(existsSync(backupPath)).toBe(true);

    // Verify backup is a valid SQLite database
    const backupDb = new Database(backupPath, { readonly: true });
    const rows = backupDb.query("SELECT * FROM test").all() as any[];
    expect(rows).toHaveLength(1);
    expect(rows[0].value).toBe("hello");
    backupDb.close();

    try { unlinkSync(dbPath); unlinkSync(backupPath); } catch {}
  });
});
