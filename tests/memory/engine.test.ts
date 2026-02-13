import { describe, test, expect, beforeEach } from "bun:test";
import { Database } from "bun:sqlite";
import { pruneOldChunks, getMemoryStats } from "../../src/memory/engine";

function createTestDb(): Database {
  const db = new Database(":memory:");

  // Run the memory migration schema
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

  return db;
}

function insertChunks(db: Database, count: number): void {
  const stmt = db.prepare(
    "INSERT INTO memory_chunks (source_file, chunk_index, content) VALUES (?, ?, ?)"
  );
  for (let i = 0; i < count; i++) {
    stmt.run(`file-${i}.md`, 0, `Chunk content number ${i}`);
  }
}

describe("pruneOldChunks", () => {
  let db: Database;

  beforeEach(() => {
    db = createTestDb();
  });

  test("does nothing when chunk count is under the limit", () => {
    insertChunks(db, 5);
    const pruned = pruneOldChunks(db, 10);
    expect(pruned).toBe(0);

    const row = db.query("SELECT COUNT(*) as c FROM memory_chunks").get() as { c: number };
    expect(row.c).toBe(5);
  });

  test("removes excess chunks when over the limit", () => {
    insertChunks(db, 15);
    const pruned = pruneOldChunks(db, 10);
    expect(pruned).toBe(5);

    const row = db.query("SELECT COUNT(*) as c FROM memory_chunks").get() as { c: number };
    expect(row.c).toBe(10);
  });

  test("removes the oldest chunks (lowest IDs)", () => {
    insertChunks(db, 5);
    const pruned = pruneOldChunks(db, 3);
    expect(pruned).toBe(2);

    // The first 2 chunks (lowest IDs) should be gone
    const remaining = db.query("SELECT id FROM memory_chunks ORDER BY id").all() as { id: number }[];
    expect(remaining).toHaveLength(3);
    // IDs 1 and 2 should have been pruned, leaving 3, 4, 5
    expect(remaining[0].id).toBe(3);
    expect(remaining[1].id).toBe(4);
    expect(remaining[2].id).toBe(5);
  });

  test("does nothing when count equals the limit", () => {
    insertChunks(db, 10);
    const pruned = pruneOldChunks(db, 10);
    expect(pruned).toBe(0);
  });

  test("handles empty table gracefully", () => {
    const pruned = pruneOldChunks(db, 10);
    expect(pruned).toBe(0);
  });
});

describe("getMemoryStats", () => {
  let db: Database;

  beforeEach(() => {
    db = createTestDb();
  });

  test("returns zero for an empty table", () => {
    const stats = getMemoryStats(db);
    expect(stats.totalChunks).toBe(0);
  });

  test("returns correct count after inserting chunks", () => {
    insertChunks(db, 7);
    const stats = getMemoryStats(db);
    expect(stats.totalChunks).toBe(7);
  });

  test("returns correct count after pruning", () => {
    insertChunks(db, 20);
    pruneOldChunks(db, 12);
    const stats = getMemoryStats(db);
    expect(stats.totalChunks).toBe(12);
  });

  test("returns zero when the table does not exist", () => {
    const emptyDb = new Database(":memory:");
    const stats = getMemoryStats(emptyDb);
    expect(stats.totalChunks).toBe(0);
  });
});
