CREATE TABLE IF NOT EXISTS memory_chunks (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  source_file TEXT NOT NULL,
  chunk_index INTEGER NOT NULL,
  content TEXT NOT NULL,
  embedding BLOB,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  UNIQUE(source_file, chunk_index)
);

CREATE VIRTUAL TABLE IF NOT EXISTS memory_fts USING fts5(
  content,
  source_file,
  content='memory_chunks',
  content_rowid='id'
);

CREATE TRIGGER IF NOT EXISTS memory_chunks_ai AFTER INSERT ON memory_chunks BEGIN
  INSERT INTO memory_fts(rowid, content, source_file)
  VALUES (new.id, new.content, new.source_file);
END;

CREATE TRIGGER IF NOT EXISTS memory_chunks_ad AFTER DELETE ON memory_chunks BEGIN
  INSERT INTO memory_fts(memory_fts, rowid, content, source_file)
  VALUES ('delete', old.id, old.content, old.source_file);
END;

CREATE TRIGGER IF NOT EXISTS memory_chunks_au AFTER UPDATE ON memory_chunks BEGIN
  INSERT INTO memory_fts(memory_fts, rowid, content, source_file)
  VALUES ('delete', old.id, old.content, old.source_file);
  INSERT INTO memory_fts(rowid, content, source_file)
  VALUES (new.id, new.content, new.source_file);
END;
