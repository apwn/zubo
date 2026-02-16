import { describe, test, expect, beforeEach, afterAll, mock } from "bun:test";
import { Database } from "bun:sqlite";
import { createTestDb } from "./helpers/test-db";

// ---------------------------------------------------------------------------
// Test database
// ---------------------------------------------------------------------------

let testDb: Database;

/**
 * Create the test database with all migrations applied, then fix schema
 * conflicts. Migration 008 creates a minimal `user_preferences` table.
 * Migration 024 tries to create the expanded version but `IF NOT EXISTS`
 * makes it a no-op. We drop and recreate with the schema that the
 * preferences tool actually expects.
 */
function createPersonalFeaturesDb(): Database {
  const db = createTestDb();

  // Upgrade user_preferences to the 024 schema the tool expects
  db.run("DROP TABLE IF EXISTS user_preferences");
  db.run(`
    CREATE TABLE user_preferences (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      category TEXT NOT NULL,
      key TEXT NOT NULL,
      value TEXT NOT NULL,
      confidence REAL NOT NULL DEFAULT 0.8,
      source TEXT NOT NULL DEFAULT 'inferred',
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      updated_at TEXT NOT NULL DEFAULT (datetime('now')),
      UNIQUE(category, key)
    )
  `);
  db.run(
    "CREATE INDEX IF NOT EXISTS idx_prefs_category ON user_preferences(category)"
  );

  return db;
}

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

// Personal-feature tools are now registered as "auto" in the permissions map,
// so no mock needed here.

// Sandbox should never kick in for built-in tools
mock.module("../src/tools/sandbox", () => ({
  executeSandboxed: async () => "sandboxed-noop",
}));

// Follow-ups scheduler mocks
const cronJobsAdded: any[] = [];
const cronJobsRemoved: any[] = [];

mock.module("../src/scheduler/cron", () => ({
  addCronJob: (...args: any[]) => {
    cronJobsAdded.push(args);
  },
  removeCronJob: (...args: any[]) => {
    cronJobsRemoved.push(args);
  },
}));

mock.module("../src/scheduler/natural-cron", () => ({
  parseNaturalSchedule: (input: string) => {
    if (input.includes("invalid")) return "Could not parse schedule";
    return { cron: new Date(Date.now() + 3_600_000).toISOString(), once: true };
  },
}));

// ---------------------------------------------------------------------------
// Import modules under test AFTER mocks are set up
// ---------------------------------------------------------------------------

const { registerTodosTool } = await import("../src/tools/builtin/todos");
const { registerNotesTool } = await import("../src/tools/builtin/notes");
const {
  registerPreferencesTool,
  loadPreferencesContext,
  extractPreferences,
} = await import("../src/tools/builtin/preferences");
const {
  registerTopicsTool,
  getActiveTopic,
  getTopicSessionId,
} = await import("../src/tools/builtin/topics");
const { registerFollowUpsTool } = await import(
  "../src/tools/builtin/follow-ups"
);
const { executeTool } = await import("../src/tools/executor");
const { getTool, unregisterTool } = await import("../src/tools/registry");

// ---------------------------------------------------------------------------
// Helper: call a tool's execute fn directly (faster, no permission layer)
// ---------------------------------------------------------------------------

async function callTool(
  name: string,
  input: Record<string, unknown>
): Promise<string> {
  const tool = getTool(name);
  if (!tool) throw new Error(`Tool "${name}" not registered`);
  return tool.execute(input);
}

// ---------------------------------------------------------------------------
// Register all tools once — the DB reference is swapped in beforeEach.
// ---------------------------------------------------------------------------

registerTodosTool();
registerNotesTool();
registerPreferencesTool();
registerTopicsTool();

// follow-ups needs the db instance + stubs for router/config/llm
const fakeRouter = {} as any;
const fakeConfig = {} as any;

// We'll register follow-ups after first DB creation (it captures the db ref)
let followUpsRegistered = false;

function ensureFollowUps() {
  if (!followUpsRegistered) {
    registerFollowUpsTool(testDb, fakeRouter, fakeConfig);
    followUpsRegistered = true;
  }
}

// ---------------------------------------------------------------------------
// Reset state before every test
// ---------------------------------------------------------------------------

beforeEach(() => {
  testDb = createPersonalFeaturesDb();
  cronJobsAdded.length = 0;
  cronJobsRemoved.length = 0;
});

afterAll(() => {
  // Clean up registered tools to avoid polluting other test files
  unregisterTool("todos");
  unregisterTool("notes");
  unregisterTool("preferences");
  unregisterTool("topics");
  unregisterTool("follow_ups");
});

// ===========================================================================
//  TODOS
// ===========================================================================

describe("todos tool", () => {
  // --- add ---

  test("add with title only returns success with ID", async () => {
    const result = await callTool("todos", { action: "add", title: "Buy milk" });
    expect(result).toContain("Added:");
    expect(result).toContain("#1");
    expect(result).toContain("Buy milk");
    expect(result).toContain("[medium]"); // default priority
  });

  test("add with priority, due_date, and tags returns full details", async () => {
    const result = await callTool("todos", {
      action: "add",
      title: "Ship feature",
      priority: "high",
      due_date: "2099-12-31",
      tags: "work, release",
    });
    expect(result).toContain("Added:");
    expect(result).toContain("Ship feature");
    expect(result).toContain("[high]");
    expect(result).toContain("due:");
    // 2099-12-31 is far in the future — should show the raw date
    expect(result).toContain("2099-12-31");
  });

  test("add without title returns error", async () => {
    const result = await callTool("todos", { action: "add" });
    expect(result).toContain("Error");
    expect(result).toContain("title is required");
  });

  // --- list ---

  test("list pending returns correct items", async () => {
    await callTool("todos", { action: "add", title: "Task A", priority: "high" });
    await callTool("todos", { action: "add", title: "Task B", priority: "low" });

    const result = await callTool("todos", { action: "list" });
    expect(result).toContain("Todos (pending");
    expect(result).toContain("2 items");
    expect(result).toContain("Task A");
    expect(result).toContain("Task B");
  });

  test("list pending excludes completed items", async () => {
    await callTool("todos", { action: "add", title: "Done task" });
    await callTool("todos", { action: "complete", id: 1 });
    await callTool("todos", { action: "add", title: "Pending task" });

    const result = await callTool("todos", { action: "list", filter: "pending" });
    expect(result).toContain("Pending task");
    expect(result).not.toContain("Done task");
  });

  test("list all shows both pending and done", async () => {
    await callTool("todos", { action: "add", title: "Item 1" });
    await callTool("todos", { action: "complete", id: 1 });
    await callTool("todos", { action: "add", title: "Item 2" });

    const result = await callTool("todos", { action: "list", filter: "all" });
    expect(result).toContain("Item 1");
    expect(result).toContain("Item 2");
    expect(result).toContain("[done]");
  });

  test("list overdue filters correctly", async () => {
    // Insert a todo with a past due date directly
    testDb
      .prepare(
        "INSERT INTO todos (title, priority, due_date) VALUES (?, ?, ?)"
      )
      .run("Overdue task", "medium", "2020-01-01");
    // And one with a future due date
    testDb
      .prepare(
        "INSERT INTO todos (title, priority, due_date) VALUES (?, ?, ?)"
      )
      .run("Future task", "medium", "2099-12-31");

    const result = await callTool("todos", { action: "list", filter: "overdue" });
    expect(result).toContain("Overdue task");
    expect(result).not.toContain("Future task");
  });

  test("list returns empty message when no todos match", async () => {
    const result = await callTool("todos", { action: "list" });
    expect(result).toContain("No pending todos found");
  });

  // --- complete ---

  test("complete marks todo as done", async () => {
    await callTool("todos", { action: "add", title: "Finish report" });
    const result = await callTool("todos", { action: "complete", id: 1 });
    expect(result).toBe("Completed todo #1.");

    // Verify in DB
    const row = testDb
      .query("SELECT status, completed_at FROM todos WHERE id = 1")
      .get() as any;
    expect(row.status).toBe("done");
    expect(row.completed_at).toBeTruthy();
  });

  test("complete with invalid id returns not found", async () => {
    const result = await callTool("todos", { action: "complete", id: 999 });
    expect(result).toContain("No todo found with id #999");
  });

  test("complete without id returns error", async () => {
    const result = await callTool("todos", { action: "complete" });
    expect(result).toContain("Error");
    expect(result).toContain("id is required");
  });

  // --- remove ---

  test("remove deletes todo", async () => {
    await callTool("todos", { action: "add", title: "Temp task" });
    const result = await callTool("todos", { action: "remove", id: 1 });
    expect(result).toBe("Removed todo #1.");

    const count = testDb
      .query("SELECT COUNT(*) as c FROM todos")
      .get() as any;
    expect(count.c).toBe(0);
  });

  test("remove with invalid id returns not found", async () => {
    const result = await callTool("todos", { action: "remove", id: 999 });
    expect(result).toContain("No todo found with id #999");
  });

  // --- update ---

  test("update priority changes the priority", async () => {
    await callTool("todos", { action: "add", title: "Update me", priority: "low" });
    const result = await callTool("todos", {
      action: "update",
      id: 1,
      priority: "urgent",
    });
    expect(result).toBe("Updated todo #1.");

    const row = testDb
      .query("SELECT priority FROM todos WHERE id = 1")
      .get() as any;
    expect(row.priority).toBe("urgent");
  });

  test("update multiple fields at once", async () => {
    await callTool("todos", { action: "add", title: "Old title" });
    await callTool("todos", {
      action: "update",
      id: 1,
      title: "New title",
      tags: "updated, multi",
    });

    const row = testDb
      .query("SELECT title, tags FROM todos WHERE id = 1")
      .get() as any;
    expect(row.title).toBe("New title");
    const tags = JSON.parse(row.tags);
    expect(tags).toContain("updated");
    expect(tags).toContain("multi");
  });

  test("update without fields returns error", async () => {
    await callTool("todos", { action: "add", title: "No change" });
    const result = await callTool("todos", { action: "update", id: 1 });
    expect(result).toContain("Error");
    expect(result).toContain("at least one field");
  });

  test("update without id returns error", async () => {
    const result = await callTool("todos", {
      action: "update",
      title: "No id",
    });
    expect(result).toContain("Error");
    expect(result).toContain("id is required");
  });

  // --- unknown action ---

  test("unknown action returns error message", async () => {
    const result = await callTool("todos", { action: "explode" });
    expect(result).toContain("Unknown action: explode");
  });

  // --- executeTool integration ---

  test("executeTool returns proper ToolResult shape", async () => {
    const result = await executeTool("todos", "tu-1", {
      action: "add",
      title: "Via executor",
    });
    expect(result.tool_use_id).toBe("tu-1");
    expect(result.is_error).toBe(false);
    expect(result.content).toContain("Added:");
    expect(result.content).toContain("Via executor");
  });
});

// ===========================================================================
//  NOTES
// ===========================================================================

describe("notes tool", () => {
  // --- save ---

  test("save creates a note and returns its ID", async () => {
    const result = await callTool("notes", {
      action: "save",
      title: "Meeting notes",
      content: "Discussed roadmap for Q3.",
    });
    expect(result).toContain("Note saved:");
    expect(result).toContain("#1");
    expect(result).toContain("Meeting notes");
  });

  test("save with tags stores tags correctly", async () => {
    await callTool("notes", {
      action: "save",
      title: "Tagged note",
      content: "Content here",
      tags: "work, ideas",
    });

    const row = testDb
      .query("SELECT tags FROM notes WHERE id = 1")
      .get() as any;
    const tags = JSON.parse(row.tags);
    expect(tags).toContain("work");
    expect(tags).toContain("ideas");
  });

  test("save without title returns error", async () => {
    const result = await callTool("notes", {
      action: "save",
      content: "No title",
    });
    expect(result).toContain("Error");
    expect(result).toContain("title is required");
  });

  test("save without content returns error", async () => {
    const result = await callTool("notes", {
      action: "save",
      title: "No content",
    });
    expect(result).toContain("Error");
    expect(result).toContain("content is required");
  });

  // --- list ---

  test("list returns notes sorted by pinned then updated_at", async () => {
    await callTool("notes", {
      action: "save",
      title: "Note A",
      content: "First note",
    });
    await callTool("notes", {
      action: "save",
      title: "Note B",
      content: "Second note",
    });
    // Pin Note A
    await callTool("notes", { action: "pin", id: 1 });

    const result = await callTool("notes", { action: "list" });
    expect(result).toContain("Notes (2 total)");
    // Pinned note should appear first
    const indexA = result.indexOf("Note A");
    const indexB = result.indexOf("Note B");
    expect(indexA).toBeLessThan(indexB);
  });

  test("list returns empty message when no notes exist", async () => {
    const result = await callTool("notes", { action: "list" });
    expect(result).toBe("No notes found.");
  });

  test("list respects limit parameter", async () => {
    for (let i = 1; i <= 5; i++) {
      await callTool("notes", {
        action: "save",
        title: `Note ${i}`,
        content: `Content ${i}`,
      });
    }

    const result = await callTool("notes", { action: "list", limit: 2 });
    expect(result).toContain("2 total");
  });

  // --- search ---

  test("search via FTS finds matching notes", async () => {
    await callTool("notes", {
      action: "save",
      title: "TypeScript tips",
      content: "Use strict mode for better type safety.",
    });
    await callTool("notes", {
      action: "save",
      title: "Grocery list",
      content: "Eggs, milk, bread.",
    });

    const result = await callTool("notes", {
      action: "search",
      query: "TypeScript",
    });
    expect(result).toContain("TypeScript tips");
    expect(result).not.toContain("Grocery list");
  });

  test("search with no results returns appropriate message", async () => {
    await callTool("notes", {
      action: "save",
      title: "Unrelated",
      content: "Nothing relevant here.",
    });

    const result = await callTool("notes", {
      action: "search",
      query: "quantum",
    });
    expect(result).toContain('No notes found matching "quantum"');
  });

  test("search without query returns error", async () => {
    const result = await callTool("notes", { action: "search" });
    expect(result).toContain("Error");
    expect(result).toContain("query is required");
  });

  // --- update ---

  test("update modifies note fields", async () => {
    await callTool("notes", {
      action: "save",
      title: "Original",
      content: "Original content",
    });

    const result = await callTool("notes", {
      action: "update",
      id: 1,
      title: "Updated title",
      content: "Updated content",
    });
    expect(result).toBe("Updated note #1.");

    const row = testDb
      .query("SELECT title, content FROM notes WHERE id = 1")
      .get() as any;
    expect(row.title).toBe("Updated title");
    expect(row.content).toBe("Updated content");
  });

  test("update with invalid id returns not found", async () => {
    const result = await callTool("notes", {
      action: "update",
      id: 999,
      title: "Nope",
    });
    expect(result).toContain("No note found with id #999");
  });

  test("update without any fields returns error", async () => {
    await callTool("notes", {
      action: "save",
      title: "Test",
      content: "Content",
    });
    const result = await callTool("notes", { action: "update", id: 1 });
    expect(result).toContain("Error");
    expect(result).toContain("at least one field");
  });

  // --- delete ---

  test("delete removes the note", async () => {
    await callTool("notes", {
      action: "save",
      title: "To delete",
      content: "Gone soon",
    });
    const result = await callTool("notes", { action: "delete", id: 1 });
    expect(result).toBe("Deleted note #1.");

    const count = testDb
      .query("SELECT COUNT(*) as c FROM notes")
      .get() as any;
    expect(count.c).toBe(0);
  });

  test("delete with invalid id returns not found", async () => {
    const result = await callTool("notes", { action: "delete", id: 999 });
    expect(result).toContain("No note found with id #999");
  });

  // --- pin ---

  test("pin toggles pin state on", async () => {
    await callTool("notes", {
      action: "save",
      title: "Pin me",
      content: "Important note",
    });
    const result = await callTool("notes", { action: "pin", id: 1 });
    expect(result).toContain("Note #1 is now pinned");
  });

  test("pin toggles pin state off (unpin)", async () => {
    await callTool("notes", {
      action: "save",
      title: "Unpin me",
      content: "Less important",
    });
    // Pin then unpin
    await callTool("notes", { action: "pin", id: 1 });
    const result = await callTool("notes", { action: "pin", id: 1 });
    expect(result).toContain("Note #1 is now unpinned");
  });

  test("pin with invalid id returns not found", async () => {
    const result = await callTool("notes", { action: "pin", id: 999 });
    expect(result).toContain("No note found with id #999");
  });

  // --- unknown action ---

  test("unknown action returns error message", async () => {
    const result = await callTool("notes", { action: "archive" });
    expect(result).toContain("Unknown action: archive");
  });
});

// ===========================================================================
//  PREFERENCES
// ===========================================================================

describe("preferences tool", () => {
  // --- set ---

  test("set stores a preference", async () => {
    const result = await callTool("preferences", {
      action: "set",
      category: "food",
      key: "coffee_order",
      value: "oat milk latte",
    });
    expect(result).toBe("Preference saved: food/coffee_order = oat milk latte");

    const row = testDb
      .query(
        "SELECT value, confidence, source FROM user_preferences WHERE category = ? AND key = ?"
      )
      .get("food", "coffee_order") as any;
    expect(row.value).toBe("oat milk latte");
    expect(row.confidence).toBe(0.9); // default
    expect(row.source).toBe("explicit");
  });

  test("set with custom confidence stores it", async () => {
    await callTool("preferences", {
      action: "set",
      category: "work",
      key: "editor",
      value: "VSCode",
      confidence: 0.7,
    });

    const row = testDb
      .query(
        "SELECT confidence FROM user_preferences WHERE category = ? AND key = ?"
      )
      .get("work", "editor") as any;
    expect(row.confidence).toBe(0.7);
  });

  test("set overwrites existing preference (upsert)", async () => {
    await callTool("preferences", {
      action: "set",
      category: "food",
      key: "coffee_order",
      value: "black coffee",
    });
    await callTool("preferences", {
      action: "set",
      category: "food",
      key: "coffee_order",
      value: "espresso",
    });

    const row = testDb
      .query(
        "SELECT value FROM user_preferences WHERE category = ? AND key = ?"
      )
      .get("food", "coffee_order") as any;
    expect(row.value).toBe("espresso");

    // Ensure only one row exists
    const count = testDb
      .query("SELECT COUNT(*) as c FROM user_preferences")
      .get() as any;
    expect(count.c).toBe(1);
  });

  test("set without required fields returns error", async () => {
    const result = await callTool("preferences", { action: "set" });
    expect(result).toContain("Error");
    expect(result).toContain("category, key, and value are required");
  });

  // --- get ---

  test("get retrieves a stored preference", async () => {
    await callTool("preferences", {
      action: "set",
      category: "coding",
      key: "language",
      value: "TypeScript",
    });
    const result = await callTool("preferences", {
      action: "get",
      category: "coding",
      key: "language",
    });
    expect(result).toBe("TypeScript");
  });

  test("get with nonexistent key returns not found", async () => {
    const result = await callTool("preferences", {
      action: "get",
      category: "nope",
      key: "nada",
    });
    expect(result).toBe("No preference found.");
  });

  test("get without category or key returns error", async () => {
    const result = await callTool("preferences", { action: "get" });
    expect(result).toContain("Error");
    expect(result).toContain("category and key are required");
  });

  // --- list ---

  test("list shows all preferences grouped by category", async () => {
    await callTool("preferences", {
      action: "set",
      category: "coding",
      key: "language",
      value: "TypeScript",
    });
    await callTool("preferences", {
      action: "set",
      category: "coding",
      key: "editor",
      value: "Neovim",
    });
    await callTool("preferences", {
      action: "set",
      category: "food",
      key: "cuisine",
      value: "Japanese",
    });

    const result = await callTool("preferences", { action: "list" });
    expect(result).toContain("## Coding");
    expect(result).toContain("## Food");
    expect(result).toContain("language: TypeScript");
    expect(result).toContain("editor: Neovim");
    expect(result).toContain("cuisine: Japanese");
  });

  test("list with no preferences returns empty message", async () => {
    const result = await callTool("preferences", { action: "list" });
    expect(result).toBe("No preferences saved yet.");
  });

  // --- remove ---

  test("remove deletes a preference", async () => {
    await callTool("preferences", {
      action: "set",
      category: "food",
      key: "drink",
      value: "water",
    });
    const result = await callTool("preferences", {
      action: "remove",
      category: "food",
      key: "drink",
    });
    expect(result).toBe("Preference removed: food/drink");

    const count = testDb
      .query("SELECT COUNT(*) as c FROM user_preferences")
      .get() as any;
    expect(count.c).toBe(0);
  });

  test("remove nonexistent preference returns not found", async () => {
    const result = await callTool("preferences", {
      action: "remove",
      category: "nope",
      key: "nada",
    });
    expect(result).toContain("No preference found for nope/nada");
  });

  test("remove without category/key returns error", async () => {
    const result = await callTool("preferences", { action: "remove" });
    expect(result).toContain("Error");
    expect(result).toContain("category and key are required");
  });

  // --- unknown action ---

  test("unknown action returns error message", async () => {
    const result = await callTool("preferences", { action: "reset" });
    expect(result).toContain("Unknown action: reset");
  });

  // --- loadPreferencesContext ---

  test("loadPreferencesContext formats preferences for system prompt", async () => {
    await callTool("preferences", {
      action: "set",
      category: "communication",
      key: "tone",
      value: "casual",
    });
    await callTool("preferences", {
      action: "set",
      category: "communication",
      key: "language",
      value: "English",
    });
    await callTool("preferences", {
      action: "set",
      category: "work",
      key: "role",
      value: "engineer",
    });

    const context = await loadPreferencesContext();
    expect(context).toContain("## User preferences");
    expect(context).toContain("**communication:**");
    expect(context).toContain("- tone: casual");
    expect(context).toContain("- language: English");
    expect(context).toContain("**work:**");
    expect(context).toContain("- role: engineer");
  });

  test("loadPreferencesContext returns empty string when no prefs exist", async () => {
    const context = await loadPreferencesContext();
    expect(context).toBe("");
  });

  // --- extractPreferences ---

  test("extractPreferences returns empty array (conservative design)", () => {
    // The current implementation is intentionally conservative and returns []
    const result = extractPreferences("I prefer TypeScript over JavaScript");
    expect(Array.isArray(result)).toBe(true);
    expect(result.length).toBe(0);
  });
});

// ===========================================================================
//  TOPICS
// ===========================================================================

describe("topics tool", () => {
  // Reset the module-level activeTopic between describes by switching to
  // "current" and checking state. We cannot directly reset the module var,
  // but we can archive any active topic.

  // --- create ---

  test("create inserts a new topic", async () => {
    const result = await callTool("topics", {
      action: "create",
      name: "trip planning",
      description: "Summer vacation",
    });
    expect(result).toContain("Topic 'trip planning' created");

    const row = testDb
      .query("SELECT * FROM conversation_topics WHERE name = ?")
      .get("trip planning") as any;
    expect(row).toBeTruthy();
    expect(row.description).toBe("Summer vacation");
    expect(row.status).toBe("active");
  });

  test("create without name returns error", async () => {
    const result = await callTool("topics", { action: "create" });
    expect(result).toContain("Error");
    expect(result).toContain("'name' is required");
  });

  // --- switch ---

  test("switch sets the active topic", async () => {
    await callTool("topics", {
      action: "create",
      name: "work project",
    });
    const result = await callTool("topics", {
      action: "switch",
      name: "work project",
    });
    expect(result).toContain("Switched to topic: work project");

    // Verify the module-level state
    expect(getActiveTopic()).toBe("work project");
  });

  test("switch to nonexistent topic auto-creates it", async () => {
    const result = await callTool("topics", {
      action: "switch",
      name: "new topic",
    });
    expect(result).toContain("Switched to topic: new topic");

    const row = testDb
      .query("SELECT * FROM conversation_topics WHERE name = ?")
      .get("new topic") as any;
    expect(row).toBeTruthy();
  });

  test("switch without name returns error", async () => {
    const result = await callTool("topics", { action: "switch" });
    expect(result).toContain("Error");
    expect(result).toContain("'name' is required");
  });

  // --- list ---

  test("list shows active topics", async () => {
    await callTool("topics", { action: "create", name: "alpha" });
    await callTool("topics", { action: "create", name: "beta" });

    const result = await callTool("topics", { action: "list" });
    expect(result).toContain("Active topics:");
    expect(result).toContain("alpha");
    expect(result).toContain("beta");
  });

  test("list shows current topic", async () => {
    await callTool("topics", { action: "create", name: "focus" });
    await callTool("topics", { action: "switch", name: "focus" });

    const result = await callTool("topics", { action: "list" });
    expect(result).toContain("Current: focus");
  });

  test("list with no topics returns helpful message", async () => {
    // Reset active topic by creating + archiving it in the fresh DB
    const current = getActiveTopic();
    if (current) {
      await callTool("topics", { action: "create", name: current });
      await callTool("topics", { action: "archive", name: current });
    }

    const result = await callTool("topics", { action: "list" });
    expect(result).toContain("No active topics yet");
    expect(result).toContain("Create one");
  });

  // --- archive ---

  test("archive hides a topic", async () => {
    await callTool("topics", { action: "create", name: "old project" });
    const result = await callTool("topics", {
      action: "archive",
      name: "old project",
    });
    expect(result).toContain("Topic 'old project' archived");

    const row = testDb
      .query("SELECT status FROM conversation_topics WHERE name = ?")
      .get("old project") as any;
    expect(row.status).toBe("archived");
  });

  test("archive resets activeTopic if it was the active one", async () => {
    await callTool("topics", { action: "create", name: "temp" });
    await callTool("topics", { action: "switch", name: "temp" });
    expect(getActiveTopic()).toBe("temp");

    await callTool("topics", { action: "archive", name: "temp" });
    expect(getActiveTopic()).toBeNull();
  });

  test("archive nonexistent topic returns not found", async () => {
    const result = await callTool("topics", {
      action: "archive",
      name: "ghost",
    });
    expect(result).toContain("No active topic found with name 'ghost'");
  });

  test("archive without name returns error", async () => {
    const result = await callTool("topics", { action: "archive" });
    expect(result).toContain("Error");
    expect(result).toContain("'name' is required");
  });

  // --- current ---

  test("current returns active topic name", async () => {
    await callTool("topics", { action: "create", name: "my topic" });
    await callTool("topics", { action: "switch", name: "my topic" });

    const result = await callTool("topics", { action: "current" });
    expect(result).toBe("my topic");
  });

  test("current returns default when no topic selected", async () => {
    // Ensure any stale activeTopic from previous tests is cleared.
    // We must create the topic in the fresh DB before we can archive it.
    const current = getActiveTopic();
    if (current) {
      await callTool("topics", { action: "create", name: current });
      await callTool("topics", { action: "archive", name: current });
    }

    const result = await callTool("topics", { action: "current" });
    expect(result).toContain("default");
    expect(result).toContain("no topic selected");
  });

  // --- unknown action ---

  test("unknown action returns error message", async () => {
    const result = await callTool("topics", { action: "rename" });
    expect(result).toContain("Unknown action: rename");
  });

  // --- getActiveTopic / getTopicSessionId ---

  test("getActiveTopic returns null when no topic set", async () => {
    const current = getActiveTopic();
    if (current) {
      await callTool("topics", { action: "create", name: current });
      await callTool("topics", { action: "archive", name: current });
    }
    expect(getActiveTopic()).toBeNull();
  });

  test("getActiveTopic returns topic name after switch", async () => {
    await callTool("topics", { action: "create", name: "session test" });
    await callTool("topics", { action: "switch", name: "session test" });
    expect(getActiveTopic()).toBe("session test");
  });

  test("getTopicSessionId returns 'owner' when no topic", async () => {
    const current = getActiveTopic();
    if (current) {
      await callTool("topics", { action: "create", name: current });
      await callTool("topics", { action: "archive", name: current });
    }
    expect(getTopicSessionId()).toBe("owner");
  });

  test("getTopicSessionId returns sanitized ID for active topic", async () => {
    await callTool("topics", { action: "create", name: "Work Project!" });
    await callTool("topics", { action: "switch", name: "Work Project!" });
    const sessionId = getTopicSessionId();
    expect(sessionId).toBe("topic-work-project");
    // Should not contain special characters
    expect(sessionId).not.toContain("!");
    expect(sessionId).not.toContain(" ");
  });

  test("getTopicSessionId handles leading/trailing special chars", async () => {
    await callTool("topics", { action: "create", name: "---test---" });
    await callTool("topics", { action: "switch", name: "---test---" });
    const sessionId = getTopicSessionId();
    expect(sessionId).toBe("topic-test");
  });
});

// ===========================================================================
//  FOLLOW-UPS
// ===========================================================================

describe("follow_ups tool", () => {
  // follow-ups captures the db reference at registration time, so we need
  // to re-register for each test with the fresh testDb. We'll use the
  // callTool helper which goes through the registry.

  beforeEach(() => {
    // Re-register follow-ups with the new testDb
    unregisterTool("follow_ups");
    registerFollowUpsTool(testDb, fakeRouter, fakeConfig);
    followUpsRegistered = true;
  });

  // --- schedule ---

  test("schedule creates a follow-up and cron job", async () => {
    const result = await callTool("follow_ups", {
      action: "schedule",
      context: "dentist appointment",
      message: "How did the dentist go?",
      delay: "in 2 hours",
    });
    expect(result).toContain("Follow-up scheduled");
    expect(result).toContain("How did the dentist go?");

    // Verify DB record
    const row = testDb
      .query("SELECT * FROM follow_ups WHERE id = 1")
      .get() as any;
    expect(row).toBeTruthy();
    expect(row.context).toBe("dentist appointment");
    expect(row.message).toBe("How did the dentist go?");
    expect(row.status).toBe("pending");

    // Verify cron job was added
    expect(cronJobsAdded.length).toBe(1);
    expect(cronJobsAdded[0][1]).toBe("followup-1"); // cronName
  });

  test("schedule adds 'in' prefix if missing from delay", async () => {
    await callTool("follow_ups", {
      action: "schedule",
      context: "interview",
      message: "How did the interview go?",
      delay: "2 hours",
    });

    // Should still succeed (code prepends "in " if missing)
    expect(cronJobsAdded.length).toBe(1);
  });

  test("schedule without required fields returns error", async () => {
    const result = await callTool("follow_ups", { action: "schedule" });
    expect(result).toContain("Error");
    expect(result).toContain("context, message, and delay are required");
  });

  test("schedule with unparseable delay returns error", async () => {
    const result = await callTool("follow_ups", {
      action: "schedule",
      context: "test",
      message: "test message",
      delay: "invalid nonsense",
    });
    expect(result).toContain("Error");
    expect(result).toContain("does not look like a one-shot delay");
  });

  // --- list ---

  test("list shows pending follow-ups", async () => {
    await callTool("follow_ups", {
      action: "schedule",
      context: "doctor visit",
      message: "How was the doctor?",
      delay: "in 1 hour",
    });
    await callTool("follow_ups", {
      action: "schedule",
      context: "meeting",
      message: "How was the meeting?",
      delay: "in 3 hours",
    });

    const result = await callTool("follow_ups", { action: "list" });
    expect(result).toContain("doctor visit");
    expect(result).toContain("How was the doctor?");
    expect(result).toContain("meeting");
    expect(result).toContain("How was the meeting?");
  });

  test("list with no pending follow-ups returns message", async () => {
    const result = await callTool("follow_ups", { action: "list" });
    expect(result).toBe("No pending follow-ups.");
  });

  test("list excludes cancelled follow-ups", async () => {
    await callTool("follow_ups", {
      action: "schedule",
      context: "cancelled item",
      message: "Should not appear",
      delay: "in 1 hour",
    });
    await callTool("follow_ups", { action: "cancel", id: 1 });

    const result = await callTool("follow_ups", { action: "list" });
    expect(result).toBe("No pending follow-ups.");
  });

  // --- cancel ---

  test("cancel marks follow-up as cancelled and removes cron", async () => {
    await callTool("follow_ups", {
      action: "schedule",
      context: "something",
      message: "Ping",
      delay: "in 30 minutes",
    });

    cronJobsRemoved.length = 0;
    const result = await callTool("follow_ups", { action: "cancel", id: 1 });
    expect(result).toBe("Follow-up #1 cancelled.");

    // Verify DB status
    const row = testDb
      .query("SELECT status FROM follow_ups WHERE id = 1")
      .get() as any;
    expect(row.status).toBe("cancelled");

    // Verify cron removal
    expect(cronJobsRemoved.length).toBe(1);
    expect(cronJobsRemoved[0][1]).toBe("followup-1");
  });

  test("cancel without id returns error", async () => {
    const result = await callTool("follow_ups", { action: "cancel" });
    expect(result).toContain("Error");
    expect(result).toContain("id is required");
  });

  test("cancel with nonexistent id returns not found", async () => {
    const result = await callTool("follow_ups", { action: "cancel", id: 999 });
    expect(result).toContain("No pending follow-up found with ID 999");
  });

  test("cancel an already-cancelled follow-up returns not found", async () => {
    await callTool("follow_ups", {
      action: "schedule",
      context: "double cancel",
      message: "test",
      delay: "in 1 hour",
    });
    await callTool("follow_ups", { action: "cancel", id: 1 });

    const result = await callTool("follow_ups", { action: "cancel", id: 1 });
    expect(result).toContain("No pending follow-up found with ID 1");
  });

  // --- unknown action ---

  test("unknown action returns error message", async () => {
    const result = await callTool("follow_ups", { action: "snooze" });
    expect(result).toContain("Unknown action: snooze");
  });

  // --- executeTool integration ---

  test("executeTool works for follow_ups schedule", async () => {
    const result = await executeTool("follow_ups", "fu-1", {
      action: "schedule",
      context: "gym session",
      message: "Did you work out?",
      delay: "in 4 hours",
    });
    expect(result.tool_use_id).toBe("fu-1");
    expect(result.is_error).toBe(false);
    expect(result.content).toContain("Follow-up scheduled");
  });
});
