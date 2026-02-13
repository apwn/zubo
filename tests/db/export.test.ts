import { describe, test, expect, beforeEach, afterEach } from "bun:test";
import { Database } from "bun:sqlite";
import { mkdtempSync, rmSync, writeFileSync, readFileSync } from "fs";
import { join } from "path";
import { tmpdir } from "os";
import { exportDatabase, importDatabase } from "../../src/db/export";

function createTestDb(): Database {
  const db = new Database(":memory:");

  // Create the tables that EXPORT_TABLES references
  db.run(`
    CREATE TABLE IF NOT EXISTS sessions (
      id TEXT PRIMARY KEY,
      channel TEXT NOT NULL,
      user_id TEXT NOT NULL,
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      updated_at TEXT NOT NULL DEFAULT (datetime('now'))
    )
  `);
  db.run(`
    CREATE TABLE IF NOT EXISTS memory_chunks (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      source_file TEXT NOT NULL,
      chunk_index INTEGER NOT NULL,
      content TEXT NOT NULL,
      embedding BLOB,
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      UNIQUE(source_file, chunk_index)
    )
  `);
  db.run(`
    CREATE TABLE IF NOT EXISTS cron_jobs (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL UNIQUE,
      schedule TEXT NOT NULL,
      task TEXT NOT NULL,
      enabled INTEGER NOT NULL DEFAULT 1,
      last_run TEXT,
      next_run TEXT,
      retry_count INTEGER NOT NULL DEFAULT 0,
      max_retries INTEGER NOT NULL DEFAULT 3,
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    )
  `);
  db.run(`
    CREATE TABLE IF NOT EXISTS cron_logs (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      job_id INTEGER NOT NULL REFERENCES cron_jobs(id),
      status TEXT NOT NULL,
      output TEXT,
      error TEXT,
      started_at TEXT NOT NULL DEFAULT (datetime('now')),
      finished_at TEXT
    )
  `);
  db.run(`
    CREATE TABLE IF NOT EXISTS usage (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      session_id TEXT,
      provider TEXT NOT NULL,
      model TEXT NOT NULL,
      input_tokens INTEGER NOT NULL DEFAULT 0,
      output_tokens INTEGER NOT NULL DEFAULT 0,
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    )
  `);
  db.run(`
    CREATE TABLE IF NOT EXISTS uploads (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      filename TEXT NOT NULL,
      original_name TEXT NOT NULL,
      mime_type TEXT NOT NULL,
      size_bytes INTEGER NOT NULL,
      chunk_count INTEGER NOT NULL DEFAULT 0,
      uploaded_at TEXT NOT NULL DEFAULT (datetime('now'))
    )
  `);
  db.run(`
    CREATE TABLE IF NOT EXISTS tool_metrics (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      tool_name TEXT NOT NULL,
      session_id TEXT,
      duration_ms INTEGER NOT NULL,
      success INTEGER NOT NULL DEFAULT 1,
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    )
  `);
  db.run(`
    CREATE TABLE IF NOT EXISTS perf_snapshots (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      rss_mb REAL,
      heap_mb REAL,
      db_size_mb REAL,
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    )
  `);

  return db;
}

describe("importDatabase", () => {
  let tempDir: string;

  beforeEach(() => {
    tempDir = mkdtempSync(join(tmpdir(), "orba-export-test-"));
  });

  afterEach(() => {
    rmSync(tempDir, { recursive: true, force: true });
  });

  test("rejects unknown table names by skipping them", () => {
    const db = createTestDb();
    const importFile = join(tempDir, "import.json");

    const data = {
      version: 1,
      exportedAt: new Date().toISOString(),
      tables: {
        evil_table: [{ id: 1, payload: "malicious" }],
      },
    };
    writeFileSync(importFile, JSON.stringify(data));

    const result = importDatabase(db, importFile);
    // The unknown table should be skipped entirely (not in EXPORT_TABLES)
    expect(result.imported).toBe(0);
  });

  test("handles empty data gracefully", () => {
    const db = createTestDb();
    const importFile = join(tempDir, "empty.json");

    const data = {
      version: 1,
      exportedAt: new Date().toISOString(),
      tables: {},
    };
    writeFileSync(importFile, JSON.stringify(data));

    const result = importDatabase(db, importFile);
    expect(result.imported).toBe(0);
    expect(result.skipped).toBe(0);
  });

  test("rejects unsupported export version", () => {
    const db = createTestDb();
    const importFile = join(tempDir, "bad-version.json");

    const data = {
      version: 99,
      exportedAt: new Date().toISOString(),
      tables: {},
    };
    writeFileSync(importFile, JSON.stringify(data));

    expect(() => importDatabase(db, importFile)).toThrow("Unsupported export version");
  });
});

describe("export/import round-trip", () => {
  let tempDir: string;

  beforeEach(() => {
    tempDir = mkdtempSync(join(tmpdir(), "orba-roundtrip-test-"));
  });

  afterEach(() => {
    rmSync(tempDir, { recursive: true, force: true });
  });

  test("preserves data through export and import", () => {
    const sourceDb = createTestDb();

    // Insert test data into sessions
    sourceDb
      .prepare("INSERT INTO sessions (id, channel, user_id) VALUES (?, ?, ?)")
      .run("sess-1", "discord", "user-42");
    sourceDb
      .prepare("INSERT INTO sessions (id, channel, user_id) VALUES (?, ?, ?)")
      .run("sess-2", "telegram", "user-99");

    // Insert test data into memory_chunks
    sourceDb
      .prepare(
        "INSERT INTO memory_chunks (source_file, chunk_index, content) VALUES (?, ?, ?)"
      )
      .run("notes.md", 0, "Remember this fact");

    // Export
    const exportPath = join(tempDir, "export.json");
    exportDatabase(sourceDb, exportPath);

    // Verify the export file was created
    const exportContent = JSON.parse(readFileSync(exportPath, "utf-8"));
    expect(exportContent.version).toBe(1);
    expect(exportContent.tables.sessions).toHaveLength(2);
    expect(exportContent.tables.memory_chunks).toHaveLength(1);

    // Import into a fresh database
    const targetDb = createTestDb();
    const result = importDatabase(targetDb, exportPath);

    expect(result.imported).toBe(3); // 2 sessions + 1 memory chunk

    // Verify the data
    const sessions = targetDb.query("SELECT * FROM sessions ORDER BY id").all() as any[];
    expect(sessions).toHaveLength(2);
    expect(sessions[0].id).toBe("sess-1");
    expect(sessions[0].channel).toBe("discord");
    expect(sessions[1].id).toBe("sess-2");
    expect(sessions[1].channel).toBe("telegram");

    const chunks = targetDb.query("SELECT * FROM memory_chunks").all() as any[];
    expect(chunks).toHaveLength(1);
    expect(chunks[0].content).toBe("Remember this fact");
  });
});
