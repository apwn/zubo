import { describe, it, expect } from "bun:test";
import { createTestDb } from "./helpers/test-db";
import { ftsSearch } from "../src/memory/fts-index";

describe("Memory Engine", () => {
  it("should create memory_chunks table in test DB", () => {
    const db = createTestDb();
    const result = db.query("SELECT name FROM sqlite_master WHERE type='table' AND name='memory_chunks'").get() as any;
    expect(result).toBeTruthy();
    expect(result.name).toBe("memory_chunks");
    db.close();
  });

  it("should insert and retrieve memory chunks", () => {
    const db = createTestDb();
    db.prepare("INSERT INTO memory_chunks (source_file, chunk_index, content) VALUES (?, ?, ?)").run("test.md", 0, "Hello world");

    const chunks = db.query("SELECT * FROM memory_chunks WHERE source_file = 'test.md'").all() as any[];
    expect(chunks.length).toBe(1);
    expect(chunks[0].content).toBe("Hello world");
    expect(chunks[0].chunk_index).toBe(0);
    db.close();
  });

  it("should support FTS search via triggers", () => {
    const db = createTestDb();
    // Inserting into memory_chunks should auto-populate memory_fts via triggers
    db.prepare("INSERT INTO memory_chunks (source_file, chunk_index, content) VALUES (?, ?, ?)").run("a.md", 0, "TypeScript is great");
    db.prepare("INSERT INTO memory_chunks (source_file, chunk_index, content) VALUES (?, ?, ?)").run("b.md", 0, "Python is cool");

    const results = db.query("SELECT * FROM memory_fts WHERE memory_fts MATCH 'TypeScript'").all() as any[];
    expect(results.length).toBe(1);
    db.close();
  });

  it("should include explainability metadata for FTS results", () => {
    const db = createTestDb();
    db.prepare("INSERT INTO memory_chunks (source_file, chunk_index, content) VALUES (?, ?, ?)").run("a.md", 0, "alice prefers espresso");
    const results = ftsSearch(db, "alice", 3);
    expect(results.length).toBeGreaterThan(0);
    expect(results[0].matchType).toBe("fts");
    expect(results[0].confidence).toBeGreaterThanOrEqual(0);
    expect(results[0].confidence).toBeLessThanOrEqual(1);
    expect(results[0].reasons).toContain("keyword match");
    db.close();
  });

  it("should handle dedup on re-index", () => {
    const db = createTestDb();
    db.prepare("INSERT INTO memory_chunks (source_file, chunk_index, content) VALUES (?, ?, ?)").run("test.md", 0, "original");

    // Update same chunk (UNIQUE constraint on source_file, chunk_index)
    db.prepare("UPDATE memory_chunks SET content = ? WHERE source_file = ? AND chunk_index = ?").run("updated", "test.md", 0);

    const chunks = db.query("SELECT * FROM memory_chunks WHERE source_file = 'test.md'").all() as any[];
    expect(chunks.length).toBe(1);
    expect(chunks[0].content).toBe("updated");
    db.close();
  });

  it("should enforce unique constraint on source_file + chunk_index", () => {
    const db = createTestDb();
    db.prepare("INSERT INTO memory_chunks (source_file, chunk_index, content) VALUES (?, ?, ?)").run("test.md", 0, "first");

    expect(() => {
      db.prepare("INSERT INTO memory_chunks (source_file, chunk_index, content) VALUES (?, ?, ?)").run("test.md", 0, "duplicate");
    }).toThrow();
    db.close();
  });
});
