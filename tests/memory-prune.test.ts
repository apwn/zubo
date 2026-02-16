import { describe, test, expect, beforeEach, afterAll, mock } from "bun:test";
import { Database } from "bun:sqlite";
import { createTestDb } from "./helpers/test-db";

// ---------------------------------------------------------------------------
// Test database
// ---------------------------------------------------------------------------

let testDb: Database;

// ---------------------------------------------------------------------------
// Mocks — must be declared BEFORE importing any module under test
// ---------------------------------------------------------------------------

mock.module("../src/db/connection", () => ({
  getDb: () => testDb,
  closeDb: () => {},
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
  recordError: () => {},
}));

mock.module("../src/tools/sandbox", () => ({
  executeSandboxed: async () => "sandboxed-noop",
}));

// ---------------------------------------------------------------------------
// Import modules under test AFTER mocks are set up
// ---------------------------------------------------------------------------

const { registerMemoryPruneTool } = await import(
  "../src/tools/builtin/memory-prune"
);
const { getTool, unregisterTool } = await import("../src/tools/registry");

// ---------------------------------------------------------------------------
// Helper: call the memory_prune tool's execute fn directly
// ---------------------------------------------------------------------------

async function callTool(input: Record<string, unknown>): Promise<string> {
  const tool = getTool("memory_prune");
  if (!tool) throw new Error('Tool "memory_prune" not registered');
  return tool.execute(input);
}

// ---------------------------------------------------------------------------
// Helper: insert a memory chunk with explicit fields
// ---------------------------------------------------------------------------

let chunkCounter = 0;

function insertChunk(
  db: Database,
  opts: {
    id?: number;
    content: string;
    source_file?: string;
    chunk_index?: number;
    created_at?: string;
  }
) {
  const source = opts.source_file ?? "test.ts";
  const chunkIdx = opts.chunk_index ?? chunkCounter++;
  const created = opts.created_at ?? new Date().toISOString().replace("T", " ").slice(0, 19);

  if (opts.id != null) {
    db.prepare(
      `INSERT INTO memory_chunks (id, source_file, chunk_index, content, embedding, created_at)
       VALUES (?, ?, ?, ?, '', ?)`
    ).run(opts.id, source, chunkIdx, opts.content, created);
  } else {
    db.prepare(
      `INSERT INTO memory_chunks (source_file, chunk_index, content, embedding, created_at)
       VALUES (?, ?, ?, '', ?)`
    ).run(source, chunkIdx, opts.content, created);
  }
}

// ---------------------------------------------------------------------------
// Register the tool once — the DB reference is swapped in beforeEach
// ---------------------------------------------------------------------------

registerMemoryPruneTool();

// ---------------------------------------------------------------------------
// Reset state before every test
// ---------------------------------------------------------------------------

beforeEach(() => {
  testDb = createTestDb();
  chunkCounter = 0;
});

afterAll(() => {
  unregisterTool("memory_prune");
});

// ===========================================================================
//  delete_by_id
// ===========================================================================

describe("memory_prune — delete_by_id", () => {
  test("deletes an existing chunk by ID", async () => {
    insertChunk(testDb, { id: 1, content: "Remember to buy groceries" });

    const result = await callTool({ action: "delete_by_id", id: 1 });
    expect(result).toContain("Deleted memory chunk #1");
    expect(result).toContain("Remember to buy groceries");

    const count = testDb
      .query("SELECT COUNT(*) as c FROM memory_chunks")
      .get() as any;
    expect(count.c).toBe(0);
  });

  test("returns error when id is missing", async () => {
    const result = await callTool({ action: "delete_by_id" });
    expect(result).toContain("Error");
    expect(result).toContain("'id' is required");
  });

  test("returns not-found for non-existent ID", async () => {
    const result = await callTool({ action: "delete_by_id", id: 999 });
    expect(result).toContain("No memory chunk found with ID 999");
  });

  test("only deletes the targeted chunk, not others", async () => {
    insertChunk(testDb, { id: 1, content: "Chunk A" });
    insertChunk(testDb, { id: 2, content: "Chunk B" });

    await callTool({ action: "delete_by_id", id: 1 });

    const remaining = testDb
      .query("SELECT id FROM memory_chunks")
      .all() as any[];
    expect(remaining.length).toBe(1);
    expect(remaining[0].id).toBe(2);
  });
});

// ===========================================================================
//  delete_by_keyword
// ===========================================================================

describe("memory_prune — delete_by_keyword", () => {
  test("deletes chunks containing the keyword (case-insensitive)", async () => {
    insertChunk(testDb, { content: "Meeting notes from Monday" });
    insertChunk(testDb, { content: "meeting recap for Tuesday" });
    insertChunk(testDb, { content: "Grocery list for the week" });

    const result = await callTool({
      action: "delete_by_keyword",
      keyword: "meeting",
    });
    expect(result).toContain("Deleted 2 chunk(s)");
    expect(result).toContain('"meeting"');

    const remaining = testDb
      .query("SELECT COUNT(*) as c FROM memory_chunks")
      .get() as any;
    expect(remaining.c).toBe(1);
  });

  test("returns error when keyword is missing", async () => {
    const result = await callTool({ action: "delete_by_keyword" });
    expect(result).toContain("Error");
    expect(result).toContain("'keyword' is required");
  });

  test("returns no-match message when keyword not found", async () => {
    insertChunk(testDb, { content: "Some unrelated content" });

    const result = await callTool({
      action: "delete_by_keyword",
      keyword: "quantum",
    });
    expect(result).toContain('No memory chunks found containing "quantum"');
  });

  test("shows preview of deleted chunks (up to 5)", async () => {
    for (let i = 1; i <= 3; i++) {
      insertChunk(testDb, { content: `debug log entry ${i}` });
    }

    const result = await callTool({
      action: "delete_by_keyword",
      keyword: "debug",
    });
    expect(result).toContain("Deleted 3 chunk(s)");
    expect(result).toContain("debug log entry");
  });

  test("shows '... and N more' when deleting more than 5 chunks", async () => {
    for (let i = 1; i <= 7; i++) {
      insertChunk(testDb, { content: `repeated pattern item ${i}` });
    }

    const result = await callTool({
      action: "delete_by_keyword",
      keyword: "repeated pattern",
    });
    expect(result).toContain("Deleted 7 chunk(s)");
    expect(result).toContain("... and 2 more");
  });
});

// ===========================================================================
//  delete_older_than
// ===========================================================================

describe("memory_prune — delete_older_than", () => {
  test("deletes chunks older than N days", async () => {
    // Insert a chunk with a very old date
    insertChunk(testDb, {
      content: "Ancient chunk",
      created_at: "2020-01-01 00:00:00",
    });
    // Insert a recent chunk
    const now = new Date().toISOString().replace("T", " ").slice(0, 19);
    insertChunk(testDb, {
      content: "Recent chunk",
      created_at: now,
    });

    const result = await callTool({ action: "delete_older_than", days: 30 });
    expect(result).toContain("Deleted 1 memory chunk(s)");
    expect(result).toContain("30 day(s)");

    const remaining = testDb
      .query("SELECT content FROM memory_chunks")
      .all() as any[];
    expect(remaining.length).toBe(1);
    expect(remaining[0].content).toBe("Recent chunk");
  });

  test("returns error when days is missing", async () => {
    const result = await callTool({ action: "delete_older_than" });
    expect(result).toContain("Error");
    expect(result).toContain("'days' must be a positive number");
  });

  test("returns error when days is zero", async () => {
    const result = await callTool({ action: "delete_older_than", days: 0 });
    expect(result).toContain("Error");
    expect(result).toContain("'days' must be a positive number");
  });

  test("returns error when days is negative", async () => {
    const result = await callTool({ action: "delete_older_than", days: -5 });
    expect(result).toContain("Error");
    expect(result).toContain("'days' must be a positive number");
  });

  test("returns no-match message when all data is recent", async () => {
    const now = new Date().toISOString().replace("T", " ").slice(0, 19);
    insertChunk(testDb, { content: "Fresh chunk", created_at: now });

    const result = await callTool({ action: "delete_older_than", days: 30 });
    expect(result).toContain("No memory chunks older than 30 day(s)");
  });
});

// ===========================================================================
//  delete_duplicates
// ===========================================================================

describe("memory_prune — delete_duplicates", () => {
  test("removes exact duplicate content, keeping the oldest (lowest ID)", async () => {
    insertChunk(testDb, { id: 1, content: "duplicate content" });
    insertChunk(testDb, { id: 2, content: "duplicate content" });
    insertChunk(testDb, { id: 3, content: "duplicate content" });

    const result = await callTool({ action: "delete_duplicates" });
    expect(result).toContain("Removed 2 duplicate chunk(s)");
    expect(result).toContain("1 group(s)");

    const remaining = testDb
      .query("SELECT id FROM memory_chunks")
      .all() as any[];
    expect(remaining.length).toBe(1);
    expect(remaining[0].id).toBe(1); // Oldest (lowest ID) is kept
  });

  test("returns no-duplicates message when all content is unique", async () => {
    insertChunk(testDb, { content: "Unique content A" });
    insertChunk(testDb, { content: "Unique content B" });
    insertChunk(testDb, { content: "Unique content C" });

    const result = await callTool({ action: "delete_duplicates" });
    expect(result).toBe("No duplicate memory chunks found.");

    const count = testDb
      .query("SELECT COUNT(*) as c FROM memory_chunks")
      .get() as any;
    expect(count.c).toBe(3);
  });

  test("handles multiple duplicate groups correctly", async () => {
    insertChunk(testDb, { id: 1, content: "alpha" });
    insertChunk(testDb, { id: 2, content: "alpha" });
    insertChunk(testDb, { id: 3, content: "beta" });
    insertChunk(testDb, { id: 4, content: "beta" });
    insertChunk(testDb, { id: 5, content: "gamma" }); // unique

    const result = await callTool({ action: "delete_duplicates" });
    expect(result).toContain("Removed 2 duplicate chunk(s)");
    expect(result).toContain("2 group(s)");

    const remaining = testDb
      .query("SELECT id, content FROM memory_chunks ORDER BY id")
      .all() as any[];
    expect(remaining.length).toBe(3);
    expect(remaining[0].id).toBe(1);
    expect(remaining[0].content).toBe("alpha");
    expect(remaining[1].id).toBe(3);
    expect(remaining[1].content).toBe("beta");
    expect(remaining[2].id).toBe(5);
    expect(remaining[2].content).toBe("gamma");
  });

  test("keeps the oldest (lowest ID) when IDs are not sequential", async () => {
    insertChunk(testDb, { id: 10, content: "same thing" });
    insertChunk(testDb, { id: 5, content: "same thing" });
    insertChunk(testDb, { id: 20, content: "same thing" });

    await callTool({ action: "delete_duplicates" });

    const remaining = testDb
      .query("SELECT id FROM memory_chunks")
      .all() as any[];
    expect(remaining.length).toBe(1);
    expect(remaining[0].id).toBe(5); // Lowest ID kept
  });

  test("shows '... and N more groups' when more than 5 duplicate groups", async () => {
    for (let g = 0; g < 7; g++) {
      const content = `group-${g}-content`;
      insertChunk(testDb, { content });
      insertChunk(testDb, { content });
    }

    const result = await callTool({ action: "delete_duplicates" });
    expect(result).toContain("Removed 7 duplicate chunk(s)");
    expect(result).toContain("7 group(s)");
    expect(result).toContain("... and 2 more groups");
  });
});

// ===========================================================================
//  stats
// ===========================================================================

describe("memory_prune — stats", () => {
  test("returns statistics for populated memory", async () => {
    insertChunk(testDb, {
      content: "First chunk of data",
      created_at: "2024-01-15 10:00:00",
    });
    insertChunk(testDb, {
      content: "Second chunk of data",
      created_at: "2024-06-20 14:30:00",
    });
    insertChunk(testDb, {
      content: "Third chunk of data here",
      created_at: "2025-01-01 09:00:00",
    });

    const result = await callTool({ action: "stats" });
    expect(result).toContain("Memory statistics:");
    expect(result).toContain("Total chunks: 3");
    expect(result).toContain("Oldest: 2024-01-15");
    expect(result).toContain("Newest: 2025-01-01");
    expect(result).toContain("KB");
  });

  test("returns empty message when no chunks exist", async () => {
    const result = await callTool({ action: "stats" });
    expect(result).toBe("Memory is empty. No chunks stored.");
  });

  test("calculates total content size correctly", async () => {
    // Insert known-length content
    const content1 = "A".repeat(1024); // 1 KB
    const content2 = "B".repeat(1024); // 1 KB
    insertChunk(testDb, { content: content1 });
    insertChunk(testDb, { content: content2 });

    const result = await callTool({ action: "stats" });
    expect(result).toContain("Total chunks: 2");
    expect(result).toContain("2.0 KB");
  });
});

// ===========================================================================
//  Unknown action
// ===========================================================================

describe("memory_prune — unknown action", () => {
  test("returns error for unrecognized action", async () => {
    const result = await callTool({ action: "explode" });
    expect(result).toContain('Unknown action: "explode"');
    expect(result).toContain("delete_by_id");
    expect(result).toContain("delete_by_keyword");
    expect(result).toContain("delete_older_than");
    expect(result).toContain("delete_duplicates");
    expect(result).toContain("stats");
  });
});

// ===========================================================================
//  Edge cases
// ===========================================================================

describe("memory_prune — edge cases", () => {
  test("delete_by_id with id = 0 still queries correctly", async () => {
    // ID 0 is technically valid; the tool checks for null/undefined
    const result = await callTool({ action: "delete_by_id", id: 0 });
    expect(result).toContain("No memory chunk found with ID 0");
  });

  test("delete_by_keyword is case-insensitive", async () => {
    insertChunk(testDb, { content: "TypeScript is GREAT" });
    insertChunk(testDb, { content: "typescript fundamentals" });
    insertChunk(testDb, { content: "TYPESCRIPT tips" });

    const result = await callTool({
      action: "delete_by_keyword",
      keyword: "typescript",
    });
    expect(result).toContain("Deleted 3 chunk(s)");

    const count = testDb
      .query("SELECT COUNT(*) as c FROM memory_chunks")
      .get() as any;
    expect(count.c).toBe(0);
  });

  test("delete_by_keyword matches partial content", async () => {
    insertChunk(testDb, { content: "Learn about machine learning models" });
    insertChunk(testDb, { content: "Cooking recipe for pasta" });

    const result = await callTool({
      action: "delete_by_keyword",
      keyword: "machine",
    });
    expect(result).toContain("Deleted 1 chunk(s)");

    const remaining = testDb
      .query("SELECT content FROM memory_chunks")
      .all() as any[];
    expect(remaining.length).toBe(1);
    expect(remaining[0].content).toContain("Cooking");
  });

  test("delete_older_than with very large days value deletes nothing recent", async () => {
    const now = new Date().toISOString().replace("T", " ").slice(0, 19);
    insertChunk(testDb, { content: "Just now", created_at: now });

    const result = await callTool({
      action: "delete_older_than",
      days: 99999,
    });
    expect(result).toContain("No memory chunks older than 99999 day(s)");
  });

  test("stats with a single chunk shows correct oldest and newest", async () => {
    insertChunk(testDb, {
      content: "Only chunk",
      created_at: "2025-03-15 12:00:00",
    });

    const result = await callTool({ action: "stats" });
    expect(result).toContain("Total chunks: 1");
    expect(result).toContain("Oldest: 2025-03-15");
    expect(result).toContain("Newest: 2025-03-15");
  });

  test("delete_duplicates on empty database reports no duplicates", async () => {
    const result = await callTool({ action: "delete_duplicates" });
    expect(result).toBe("No duplicate memory chunks found.");
  });

  test("delete_by_id truncates long content in confirmation", async () => {
    const longContent = "X".repeat(200);
    insertChunk(testDb, { id: 1, content: longContent });

    const result = await callTool({ action: "delete_by_id", id: 1 });
    expect(result).toContain("Deleted memory chunk #1");
    // The source truncates to 80 chars + "..."
    expect(result).toContain("...");
    // Should not contain the full 200-char string
    expect(result.length).toBeLessThan(200);
  });
});
