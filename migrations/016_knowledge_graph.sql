CREATE TABLE IF NOT EXISTS kg_entities (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL,
  type TEXT NOT NULL,
  properties TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_kg_entity_name_type ON kg_entities(name, type);

CREATE TABLE IF NOT EXISTS kg_relations (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  source_id INTEGER NOT NULL REFERENCES kg_entities(id) ON DELETE CASCADE,
  target_id INTEGER NOT NULL REFERENCES kg_entities(id) ON DELETE CASCADE,
  relation TEXT NOT NULL,
  properties TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_kg_rel_source ON kg_relations(source_id);
CREATE INDEX IF NOT EXISTS idx_kg_rel_target ON kg_relations(target_id);
CREATE INDEX IF NOT EXISTS idx_kg_rel_type ON kg_relations(relation);
