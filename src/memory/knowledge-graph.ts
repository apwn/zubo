import { Database } from "bun:sqlite";
import { logger } from "../util/logger";

export interface KgEntity {
  id: number;
  name: string;
  type: string;
  properties: Record<string, unknown> | null;
  created_at: string;
  updated_at: string;
}

export interface KgRelation {
  id: number;
  source_id: number;
  target_id: number;
  relation: string;
  properties: Record<string, unknown> | null;
  created_at: string;
}

function parseProps(raw: string | null): Record<string, unknown> | null {
  if (!raw) return null;
  try {
    return JSON.parse(raw);
  } catch {
    return null;
  }
}

function rowToEntity(row: any): KgEntity {
  return {
    ...row,
    properties: parseProps(row.properties),
  };
}

function rowToRelation(row: any): KgRelation {
  return {
    ...row,
    properties: parseProps(row.properties),
  };
}

/**
 * Add or update an entity. Upserts by (name, type).
 */
export function addEntity(
  db: Database,
  name: string,
  type: string,
  properties?: Record<string, unknown>
): KgEntity {
  const propsJson = properties ? JSON.stringify(properties) : null;

  db.prepare(
    `INSERT INTO kg_entities (name, type, properties)
     VALUES (?, ?, ?)
     ON CONFLICT(name, type) DO UPDATE SET
       properties = COALESCE(excluded.properties, kg_entities.properties),
       updated_at = datetime('now')`
  ).run(name, type, propsJson);

  const row = db.query(
    "SELECT * FROM kg_entities WHERE name = ? AND type = ?"
  ).get(name, type) as any;

  return rowToEntity(row);
}

/**
 * Add a relation between two entities. Creates entities if they don't exist.
 */
export function addRelation(
  db: Database,
  sourceName: string,
  sourceType: string,
  targetName: string,
  targetType: string,
  relation: string,
  properties?: Record<string, unknown>
): KgRelation {
  // Ensure both entities exist
  const source = addEntity(db, sourceName, sourceType);
  const target = addEntity(db, targetName, targetType);

  const propsJson = properties ? JSON.stringify(properties) : null;

  // Check if relation already exists
  const existing = db.query(
    "SELECT id FROM kg_relations WHERE source_id = ? AND target_id = ? AND relation = ?"
  ).get(source.id, target.id, relation) as { id: number } | null;

  if (existing) {
    // Update properties
    db.prepare(
      "UPDATE kg_relations SET properties = ? WHERE id = ?"
    ).run(propsJson, existing.id);
    const row = db.query("SELECT * FROM kg_relations WHERE id = ?").get(existing.id);
    return rowToRelation(row);
  }

  const result = db.prepare(
    "INSERT INTO kg_relations (source_id, target_id, relation, properties) VALUES (?, ?, ?, ?)"
  ).run(source.id, target.id, relation, propsJson);

  const row = db.query("SELECT * FROM kg_relations WHERE id = ?").get(Number(result.lastInsertRowid));
  return rowToRelation(row);
}

/**
 * Get an entity by name, with all its relations.
 */
export function queryEntity(
  db: Database,
  name: string,
  type?: string
): { entity: KgEntity; relations: { direction: string; relation: string; entity: KgEntity }[] } | null {
  let row: any;
  if (type) {
    row = db.query("SELECT * FROM kg_entities WHERE name = ? AND type = ?").get(name, type);
  } else {
    row = db.query("SELECT * FROM kg_entities WHERE name = ? COLLATE NOCASE").get(name);
  }
  if (!row) return null;

  const entity = rowToEntity(row);

  // Get all relations where this entity is source or target
  const outgoing = db.query(
    `SELECT r.*, e.name as target_name, e.type as target_type, e.properties as target_props
     FROM kg_relations r JOIN kg_entities e ON r.target_id = e.id
     WHERE r.source_id = ?`
  ).all(entity.id) as any[];

  const incoming = db.query(
    `SELECT r.*, e.name as source_name, e.type as source_type, e.properties as source_props
     FROM kg_relations r JOIN kg_entities e ON r.source_id = e.id
     WHERE r.target_id = ?`
  ).all(entity.id) as any[];

  const relations: { direction: string; relation: string; entity: KgEntity }[] = [];

  for (const r of outgoing) {
    relations.push({
      direction: "outgoing",
      relation: r.relation,
      entity: {
        id: r.target_id,
        name: r.target_name,
        type: r.target_type,
        properties: parseProps(r.target_props),
        created_at: "",
        updated_at: "",
      },
    });
  }

  for (const r of incoming) {
    relations.push({
      direction: "incoming",
      relation: r.relation,
      entity: {
        id: r.source_id,
        name: r.source_name,
        type: r.source_type,
        properties: parseProps(r.source_props),
        created_at: "",
        updated_at: "",
      },
    });
  }

  return { entity, relations };
}

/**
 * Search entities by name (fuzzy, case-insensitive).
 */
export function searchEntities(
  db: Database,
  query: string,
  type?: string,
  limit: number = 20
): KgEntity[] {
  const pattern = `%${query}%`;
  let rows: any[];
  if (type) {
    rows = db.query(
      "SELECT * FROM kg_entities WHERE name LIKE ? COLLATE NOCASE AND type = ? ORDER BY updated_at DESC LIMIT ?"
    ).all(pattern, type, limit) as any[];
  } else {
    rows = db.query(
      "SELECT * FROM kg_entities WHERE name LIKE ? COLLATE NOCASE ORDER BY updated_at DESC LIMIT ?"
    ).all(pattern, limit) as any[];
  }
  return rows.map(rowToEntity);
}

/**
 * Get relations for an entity, optionally filtered by relation type and direction.
 */
export function queryRelations(
  db: Database,
  entityName: string,
  relation?: string,
  direction?: "outgoing" | "incoming" | "both"
): { relation: string; direction: string; source: string; target: string }[] {
  const entity = db.query(
    "SELECT id FROM kg_entities WHERE name = ? COLLATE NOCASE"
  ).get(entityName) as { id: number } | null;
  if (!entity) return [];

  const results: { relation: string; direction: string; source: string; target: string }[] = [];
  const dir = direction || "both";

  if (dir === "outgoing" || dir === "both") {
    let q = `SELECT r.relation, es.name as source, et.name as target
             FROM kg_relations r
             JOIN kg_entities es ON r.source_id = es.id
             JOIN kg_entities et ON r.target_id = et.id
             WHERE r.source_id = ?`;
    const params: any[] = [entity.id];
    if (relation) {
      q += " AND r.relation = ?";
      params.push(relation);
    }
    const rows = db.query(q).all(...params) as any[];
    for (const r of rows) {
      results.push({ relation: r.relation, direction: "outgoing", source: r.source, target: r.target });
    }
  }

  if (dir === "incoming" || dir === "both") {
    let q = `SELECT r.relation, es.name as source, et.name as target
             FROM kg_relations r
             JOIN kg_entities es ON r.source_id = es.id
             JOIN kg_entities et ON r.target_id = et.id
             WHERE r.target_id = ?`;
    const params: any[] = [entity.id];
    if (relation) {
      q += " AND r.relation = ?";
      params.push(relation);
    }
    const rows = db.query(q).all(...params) as any[];
    for (const r of rows) {
      results.push({ relation: r.relation, direction: "incoming", source: r.source, target: r.target });
    }
  }

  return results;
}

/**
 * Remove an entity and cascade-delete its relations.
 */
export function removeEntity(db: Database, name: string, type?: string): boolean {
  let entity: any;
  if (type) {
    entity = db.query("SELECT id FROM kg_entities WHERE name = ? AND type = ?").get(name, type);
  } else {
    entity = db.query("SELECT id FROM kg_entities WHERE name = ? COLLATE NOCASE").get(name);
  }
  if (!entity) return false;

  db.prepare("DELETE FROM kg_relations WHERE source_id = ? OR target_id = ?").run(entity.id, entity.id);
  db.prepare("DELETE FROM kg_entities WHERE id = ?").run(entity.id);
  return true;
}

/**
 * Remove a specific relation.
 */
export function removeRelation(
  db: Database,
  sourceName: string,
  targetName: string,
  relation: string
): boolean {
  const source = db.query("SELECT id FROM kg_entities WHERE name = ? COLLATE NOCASE").get(sourceName) as { id: number } | null;
  const target = db.query("SELECT id FROM kg_entities WHERE name = ? COLLATE NOCASE").get(targetName) as { id: number } | null;
  if (!source || !target) return false;

  const result = db.prepare(
    "DELETE FROM kg_relations WHERE source_id = ? AND target_id = ? AND relation = ?"
  ).run(source.id, target.id, relation);
  return result.changes > 0;
}

/**
 * Export the graph (or a subgraph by type) as structured JSON.
 */
export function getGraph(
  db: Database,
  type?: string
): { entities: KgEntity[]; relations: { source: string; target: string; relation: string }[] } {
  let entities: any[];
  if (type) {
    entities = db.query("SELECT * FROM kg_entities WHERE type = ? ORDER BY name").all(type) as any[];
  } else {
    entities = db.query("SELECT * FROM kg_entities ORDER BY name").all() as any[];
  }

  const entityIds = new Set(entities.map((e: any) => e.id));

  const allRelations = db.query(
    `SELECT r.relation, es.name as source, et.name as target, r.source_id, r.target_id
     FROM kg_relations r
     JOIN kg_entities es ON r.source_id = es.id
     JOIN kg_entities et ON r.target_id = et.id`
  ).all() as any[];

  const relations = allRelations
    .filter((r: any) => !type || (entityIds.has(r.source_id) && entityIds.has(r.target_id)))
    .map((r: any) => ({ source: r.source, target: r.target, relation: r.relation }));

  return {
    entities: entities.map(rowToEntity),
    relations,
  };
}

/**
 * Find entity names that appear in a text string. Used for KG context injection.
 */
export function findMentionedEntities(db: Database, text: string, limit: number = 5): KgEntity[] {
  try {
    const allNames = db.query(
      "SELECT DISTINCT name FROM kg_entities ORDER BY length(name) DESC"
    ).all() as { name: string }[];

    const lowerText = text.toLowerCase();
    const matched: string[] = [];

    for (const { name } of allNames) {
      if (matched.length >= limit) break;
      if (lowerText.includes(name.toLowerCase())) {
        matched.push(name);
      }
    }

    if (matched.length === 0) return [];

    const placeholders = matched.map(() => "?").join(",");
    const rows = db.query(
      `SELECT * FROM kg_entities WHERE name IN (${placeholders}) LIMIT ?`
    ).all(...matched, limit) as any[];

    return rows.map(rowToEntity);
  } catch {
    return [];
  }
}

/**
 * Build a brief context string from mentioned entities for system prompt injection.
 */
export function buildKgContext(db: Database, text: string): string {
  const entities = findMentionedEntities(db, text, 5);
  if (entities.length === 0) return "";

  const parts: string[] = [];

  for (const entity of entities) {
    let line = `- ${entity.name} (${entity.type})`;
    if (entity.properties) {
      const propStr = Object.entries(entity.properties)
        .map(([k, v]) => `${k}: ${v}`)
        .join(", ");
      if (propStr) line += `: ${propStr}`;
    }

    // Get key relations (max 3 per entity)
    const rels = db.query(
      `SELECT r.relation, et.name as target
       FROM kg_relations r JOIN kg_entities et ON r.target_id = et.id
       WHERE r.source_id = ? LIMIT 3`
    ).all(entity.id) as any[];

    for (const r of rels) {
      line += `; ${r.relation} ${r.target}`;
    }

    parts.push(line);
  }

  const context = parts.join("\n");
  // Enforce max ~500 tokens (~2000 chars)
  return context.slice(0, 2000);
}
