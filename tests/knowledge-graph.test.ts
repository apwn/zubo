import { describe, test, expect, beforeEach } from "bun:test";
import { Database } from "bun:sqlite";
import {
  addEntity,
  addRelation,
  queryEntity,
  searchEntities,
  queryRelations,
  removeEntity,
  removeRelation,
  getGraph,
  findMentionedEntities,
  buildKgContext,
} from "../src/memory/knowledge-graph";

function createKgDb(): Database {
  const db = new Database(":memory:");
  db.run("PRAGMA foreign_keys = ON");

  db.run(`
    CREATE TABLE IF NOT EXISTS kg_entities (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      type TEXT NOT NULL,
      properties TEXT,
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      updated_at TEXT NOT NULL DEFAULT (datetime('now'))
    )
  `);
  db.run(`CREATE UNIQUE INDEX IF NOT EXISTS idx_kg_entity_name_type ON kg_entities(name, type)`);

  db.run(`
    CREATE TABLE IF NOT EXISTS kg_relations (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      source_id INTEGER NOT NULL REFERENCES kg_entities(id) ON DELETE CASCADE,
      target_id INTEGER NOT NULL REFERENCES kg_entities(id) ON DELETE CASCADE,
      relation TEXT NOT NULL,
      properties TEXT,
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    )
  `);
  db.run(`CREATE INDEX IF NOT EXISTS idx_kg_rel_source ON kg_relations(source_id)`);
  db.run(`CREATE INDEX IF NOT EXISTS idx_kg_rel_target ON kg_relations(target_id)`);
  db.run(`CREATE INDEX IF NOT EXISTS idx_kg_rel_type ON kg_relations(relation)`);

  return db;
}

// ─── addEntity ───────────────────────────────────────────────────────────────

describe("addEntity", () => {
  let db: Database;

  beforeEach(() => {
    db = createKgDb();
  });

  test("creates a new entity and returns it", () => {
    const entity = addEntity(db, "Alice", "person");
    expect(entity.name).toBe("Alice");
    expect(entity.type).toBe("person");
    expect(entity.id).toBeGreaterThan(0);
    expect(entity.properties).toBeNull();
  });

  test("creates an entity with properties", () => {
    const entity = addEntity(db, "Bob", "person", { age: 30, role: "engineer" });
    expect(entity.properties).toEqual({ age: 30, role: "engineer" });
  });

  test("upserts on duplicate (name, type) and merges properties", () => {
    const first = addEntity(db, "Alice", "person", { age: 25 });
    const second = addEntity(db, "Alice", "person", { age: 26 });
    expect(second.id).toBe(first.id);
    expect(second.properties).toEqual({ age: 26 });
  });

  test("allows the same name with different types", () => {
    const person = addEntity(db, "Python", "language");
    const animal = addEntity(db, "Python", "animal");
    expect(person.id).not.toBe(animal.id);
    expect(person.type).toBe("language");
    expect(animal.type).toBe("animal");
  });

  test("stores entity in the database", () => {
    addEntity(db, "TestEntity", "thing");
    const row = db.query("SELECT COUNT(*) as c FROM kg_entities").get() as { c: number };
    expect(row.c).toBe(1);
  });

  test("upsert with no properties keeps existing properties", () => {
    addEntity(db, "Alice", "person", { age: 25 });
    // Upsert without properties: COALESCE(null, existing) should keep existing
    const updated = addEntity(db, "Alice", "person");
    expect(updated.properties).toEqual({ age: 25 });
  });
});

// ─── queryEntity ─────────────────────────────────────────────────────────────

describe("queryEntity", () => {
  let db: Database;

  beforeEach(() => {
    db = createKgDb();
  });

  test("returns null for a non-existent entity", () => {
    const result = queryEntity(db, "Ghost");
    expect(result).toBeNull();
  });

  test("returns entity by name (case-insensitive when type omitted)", () => {
    addEntity(db, "Alice", "person");
    const result = queryEntity(db, "alice");
    expect(result).not.toBeNull();
    expect(result!.entity.name).toBe("Alice");
  });

  test("returns entity by name and type (exact match)", () => {
    addEntity(db, "Alice", "person");
    addEntity(db, "Alice", "company");
    const result = queryEntity(db, "Alice", "company");
    expect(result).not.toBeNull();
    expect(result!.entity.type).toBe("company");
  });

  test("returns outgoing relations", () => {
    addRelation(db, "Alice", "person", "Bob", "person", "knows");
    const result = queryEntity(db, "Alice");
    expect(result).not.toBeNull();
    expect(result!.relations).toHaveLength(1);
    expect(result!.relations[0].direction).toBe("outgoing");
    expect(result!.relations[0].relation).toBe("knows");
    expect(result!.relations[0].entity.name).toBe("Bob");
  });

  test("returns incoming relations", () => {
    addRelation(db, "Alice", "person", "Bob", "person", "knows");
    const result = queryEntity(db, "Bob");
    expect(result).not.toBeNull();
    expect(result!.relations).toHaveLength(1);
    expect(result!.relations[0].direction).toBe("incoming");
    expect(result!.relations[0].relation).toBe("knows");
    expect(result!.relations[0].entity.name).toBe("Alice");
  });

  test("returns both incoming and outgoing relations", () => {
    addRelation(db, "Alice", "person", "Bob", "person", "knows");
    addRelation(db, "Charlie", "person", "Alice", "person", "manages");
    const result = queryEntity(db, "Alice");
    expect(result).not.toBeNull();
    expect(result!.relations).toHaveLength(2);
    const directions = result!.relations.map(r => r.direction).sort();
    expect(directions).toEqual(["incoming", "outgoing"]);
  });
});

// ─── searchEntities ──────────────────────────────────────────────────────────

describe("searchEntities", () => {
  let db: Database;

  beforeEach(() => {
    db = createKgDb();
    addEntity(db, "Alice Johnson", "person");
    addEntity(db, "Bob Smith", "person");
    addEntity(db, "Acme Corp", "company");
    addEntity(db, "alice-bot", "software");
  });

  test("returns matching entities (case-insensitive)", () => {
    const results = searchEntities(db, "alice");
    expect(results).toHaveLength(2);
    const names = results.map(e => e.name).sort();
    expect(names).toEqual(["Alice Johnson", "alice-bot"]);
  });

  test("returns empty array when no match", () => {
    const results = searchEntities(db, "zebra");
    expect(results).toHaveLength(0);
  });

  test("filters by type", () => {
    const results = searchEntities(db, "alice", "person");
    expect(results).toHaveLength(1);
    expect(results[0].name).toBe("Alice Johnson");
  });

  test("respects limit", () => {
    const results = searchEntities(db, "%", undefined, 2);
    expect(results).toHaveLength(2);
  });

  test("partial matching works (middle of string)", () => {
    const results = searchEntities(db, "Smith");
    expect(results).toHaveLength(1);
    expect(results[0].name).toBe("Bob Smith");
  });
});

// ─── addRelation ─────────────────────────────────────────────────────────────

describe("addRelation", () => {
  let db: Database;

  beforeEach(() => {
    db = createKgDb();
  });

  test("creates a relation and auto-creates entities", () => {
    const rel = addRelation(db, "Alice", "person", "Bob", "person", "knows");
    expect(rel.relation).toBe("knows");
    expect(rel.source_id).toBeGreaterThan(0);
    expect(rel.target_id).toBeGreaterThan(0);
    expect(rel.source_id).not.toBe(rel.target_id);
  });

  test("creates relation with properties", () => {
    const rel = addRelation(db, "Alice", "person", "Acme", "company", "works_at", { role: "engineer" });
    expect(rel.properties).toEqual({ role: "engineer" });
  });

  test("updates existing relation instead of duplicating", () => {
    addRelation(db, "Alice", "person", "Bob", "person", "knows", { since: 2020 });
    const updated = addRelation(db, "Alice", "person", "Bob", "person", "knows", { since: 2021 });
    expect(updated.properties).toEqual({ since: 2021 });

    // Only one relation should exist
    const count = db.query("SELECT COUNT(*) as c FROM kg_relations").get() as { c: number };
    expect(count.c).toBe(1);
  });

  test("allows different relation types between same entities", () => {
    addRelation(db, "Alice", "person", "Bob", "person", "knows");
    addRelation(db, "Alice", "person", "Bob", "person", "manages");

    const count = db.query("SELECT COUNT(*) as c FROM kg_relations").get() as { c: number };
    expect(count.c).toBe(2);
  });

  test("reuses existing entities instead of creating duplicates", () => {
    addEntity(db, "Alice", "person", { age: 25 });
    addRelation(db, "Alice", "person", "Bob", "person", "knows");

    const entityCount = db.query("SELECT COUNT(*) as c FROM kg_entities").get() as { c: number };
    expect(entityCount.c).toBe(2); // Alice + Bob, not 3
  });
});

// ─── queryRelations ──────────────────────────────────────────────────────────

describe("queryRelations", () => {
  let db: Database;

  beforeEach(() => {
    db = createKgDb();
    addRelation(db, "Alice", "person", "Bob", "person", "knows");
    addRelation(db, "Alice", "person", "Acme", "company", "works_at");
    addRelation(db, "Charlie", "person", "Alice", "person", "manages");
  });

  test("returns all relations (both directions) by default", () => {
    const rels = queryRelations(db, "Alice");
    expect(rels).toHaveLength(3); // 2 outgoing + 1 incoming
  });

  test("filters outgoing only", () => {
    const rels = queryRelations(db, "Alice", undefined, "outgoing");
    expect(rels).toHaveLength(2);
    for (const r of rels) {
      expect(r.direction).toBe("outgoing");
      expect(r.source).toBe("Alice");
    }
  });

  test("filters incoming only", () => {
    const rels = queryRelations(db, "Alice", undefined, "incoming");
    expect(rels).toHaveLength(1);
    expect(rels[0].direction).toBe("incoming");
    expect(rels[0].target).toBe("Alice");
  });

  test("filters by relation type", () => {
    const rels = queryRelations(db, "Alice", "works_at");
    expect(rels).toHaveLength(1);
    expect(rels[0].relation).toBe("works_at");
    expect(rels[0].target).toBe("Acme");
  });

  test("returns empty array for non-existent entity", () => {
    const rels = queryRelations(db, "Nobody");
    expect(rels).toHaveLength(0);
  });

  test("case-insensitive entity lookup", () => {
    const rels = queryRelations(db, "alice");
    expect(rels.length).toBeGreaterThan(0);
  });
});

// ─── removeRelation ──────────────────────────────────────────────────────────

describe("removeRelation", () => {
  let db: Database;

  beforeEach(() => {
    db = createKgDb();
    addRelation(db, "Alice", "person", "Bob", "person", "knows");
    addRelation(db, "Alice", "person", "Acme", "company", "works_at");
  });

  test("removes a specific relation and returns true", () => {
    const result = removeRelation(db, "Alice", "Bob", "knows");
    expect(result).toBe(true);

    const count = db.query("SELECT COUNT(*) as c FROM kg_relations").get() as { c: number };
    expect(count.c).toBe(1);
  });

  test("returns false for non-existent relation", () => {
    const result = removeRelation(db, "Alice", "Bob", "hates");
    expect(result).toBe(false);
  });

  test("returns false when source entity does not exist", () => {
    const result = removeRelation(db, "Nobody", "Bob", "knows");
    expect(result).toBe(false);
  });

  test("returns false when target entity does not exist", () => {
    const result = removeRelation(db, "Alice", "Nobody", "knows");
    expect(result).toBe(false);
  });

  test("does not remove the entities themselves", () => {
    removeRelation(db, "Alice", "Bob", "knows");
    const entities = db.query("SELECT COUNT(*) as c FROM kg_entities").get() as { c: number };
    expect(entities.c).toBe(3); // Alice, Bob, Acme all remain
  });
});

// ─── removeEntity (cascade) ─────────────────────────────────────────────────

describe("removeEntity", () => {
  let db: Database;

  beforeEach(() => {
    db = createKgDb();
    addRelation(db, "Alice", "person", "Bob", "person", "knows");
    addRelation(db, "Alice", "person", "Acme", "company", "works_at");
    addRelation(db, "Charlie", "person", "Alice", "person", "manages");
  });

  test("removes entity and returns true", () => {
    const result = removeEntity(db, "Alice");
    expect(result).toBe(true);

    const entity = db.query("SELECT * FROM kg_entities WHERE name = 'Alice'").get();
    expect(entity).toBeNull();
  });

  test("cascade-deletes all relations involving the entity", () => {
    removeEntity(db, "Alice");

    // All relations involving Alice should be gone
    const rels = db.query("SELECT COUNT(*) as c FROM kg_relations").get() as { c: number };
    expect(rels.c).toBe(0); // all 3 relations involved Alice
  });

  test("does not remove unrelated entities", () => {
    removeEntity(db, "Alice");

    const bob = db.query("SELECT * FROM kg_entities WHERE name = 'Bob'").get();
    expect(bob).not.toBeNull();
  });

  test("returns false for non-existent entity", () => {
    const result = removeEntity(db, "Nobody");
    expect(result).toBe(false);
  });

  test("removes by name and type when type is specified", () => {
    addEntity(db, "Python", "language");
    addEntity(db, "Python", "animal");

    const result = removeEntity(db, "Python", "animal");
    expect(result).toBe(true);

    // The language entity should still exist
    const remaining = searchEntities(db, "Python");
    expect(remaining).toHaveLength(1);
    expect(remaining[0].type).toBe("language");
  });
});

// ─── getGraph ────────────────────────────────────────────────────────────────

describe("getGraph", () => {
  let db: Database;

  beforeEach(() => {
    db = createKgDb();
    addRelation(db, "Alice", "person", "Bob", "person", "knows");
    addRelation(db, "Alice", "person", "Acme", "company", "works_at");
    addRelation(db, "Charlie", "person", "Bob", "person", "manages");
  });

  test("returns the full graph", () => {
    const graph = getGraph(db);
    expect(graph.entities).toHaveLength(4); // Alice, Bob, Acme, Charlie
    expect(graph.relations).toHaveLength(3);
  });

  test("entities are sorted by name", () => {
    const graph = getGraph(db);
    const names = graph.entities.map(e => e.name);
    expect(names).toEqual(["Acme", "Alice", "Bob", "Charlie"]);
  });

  test("filters by type", () => {
    const graph = getGraph(db, "person");
    expect(graph.entities).toHaveLength(3); // Alice, Bob, Charlie
    // Relations only between persons
    for (const r of graph.relations) {
      expect(r.source).not.toBe("Acme");
      expect(r.target).not.toBe("Acme");
    }
  });

  test("returns empty graph for non-existent type", () => {
    const graph = getGraph(db, "spaceship");
    expect(graph.entities).toHaveLength(0);
    expect(graph.relations).toHaveLength(0);
  });

  test("returns empty graph on empty database", () => {
    const emptyDb = createKgDb();
    const graph = getGraph(emptyDb);
    expect(graph.entities).toHaveLength(0);
    expect(graph.relations).toHaveLength(0);
  });

  test("relations include source and target names", () => {
    const graph = getGraph(db);
    const knowsRel = graph.relations.find(r => r.relation === "knows");
    expect(knowsRel).toBeDefined();
    expect(knowsRel!.source).toBe("Alice");
    expect(knowsRel!.target).toBe("Bob");
  });
});

// ─── findMentionedEntities ───────────────────────────────────────────────────

describe("findMentionedEntities", () => {
  let db: Database;

  beforeEach(() => {
    db = createKgDb();
    addEntity(db, "Alice", "person");
    addEntity(db, "Bob", "person");
    addEntity(db, "Acme Corp", "company");
    addEntity(db, "TypeScript", "language");
  });

  test("finds entities mentioned in text (case-insensitive)", () => {
    const result = findMentionedEntities(db, "I was talking to alice about TypeScript");
    const names = result.map(e => e.name).sort();
    expect(names).toContain("Alice");
    expect(names).toContain("TypeScript");
  });

  test("returns empty for text with no mentions", () => {
    const result = findMentionedEntities(db, "The weather is nice today");
    expect(result).toHaveLength(0);
  });

  test("respects limit parameter", () => {
    const result = findMentionedEntities(db, "Alice and Bob at Acme Corp using TypeScript", 2);
    expect(result.length).toBeLessThanOrEqual(2);
  });

  test("handles empty text", () => {
    const result = findMentionedEntities(db, "");
    expect(result).toHaveLength(0);
  });

  test("matches multi-word entity names", () => {
    const result = findMentionedEntities(db, "We just signed a deal with Acme Corp");
    const names = result.map(e => e.name);
    expect(names).toContain("Acme Corp");
  });

  test("handles a database with no entities", () => {
    const emptyDb = createKgDb();
    const result = findMentionedEntities(emptyDb, "Alice and Bob");
    expect(result).toHaveLength(0);
  });
});

// ─── buildKgContext ──────────────────────────────────────────────────────────

describe("buildKgContext", () => {
  let db: Database;

  beforeEach(() => {
    db = createKgDb();
    addEntity(db, "Alice", "person", { role: "engineer" });
    addEntity(db, "Bob", "person", { role: "designer" });
    addRelation(db, "Alice", "person", "Bob", "person", "knows");
    addRelation(db, "Alice", "person", "Acme", "company", "works_at");
  });

  test("returns context string for mentioned entities", () => {
    const context = buildKgContext(db, "Tell me about Alice");
    expect(context).toContain("Alice");
    expect(context).toContain("person");
  });

  test("includes entity properties in context", () => {
    const context = buildKgContext(db, "Tell me about Alice");
    expect(context).toContain("role: engineer");
  });

  test("includes relations in context", () => {
    const context = buildKgContext(db, "Tell me about Alice");
    // Should include outgoing relations
    expect(context).toContain("knows");
    expect(context).toContain("Bob");
  });

  test("returns empty string when no entities mentioned", () => {
    const context = buildKgContext(db, "The weather is sunny");
    expect(context).toBe("");
  });

  test("truncates to max ~2000 chars", () => {
    // Add many entities with long properties
    for (let i = 0; i < 50; i++) {
      addEntity(db, `Entity${i}`, "thing", { description: "A".repeat(200) });
    }
    const text = Array.from({ length: 50 }, (_, i) => `Entity${i}`).join(" ");
    const context = buildKgContext(db, text);
    expect(context.length).toBeLessThanOrEqual(2000);
  });

  test("includes multiple mentioned entities", () => {
    const context = buildKgContext(db, "Meeting between Alice and Bob");
    expect(context).toContain("Alice");
    expect(context).toContain("Bob");
  });
});
