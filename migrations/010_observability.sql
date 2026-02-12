-- Enhance usage table with response time and cost
ALTER TABLE usage ADD COLUMN response_time_ms INTEGER;
ALTER TABLE usage ADD COLUMN cost_usd REAL;

-- Tool execution metrics
CREATE TABLE IF NOT EXISTS tool_metrics (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  tool_name TEXT NOT NULL,
  session_id TEXT,
  duration_ms INTEGER NOT NULL,
  success INTEGER NOT NULL DEFAULT 1,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

-- Performance snapshots
CREATE TABLE IF NOT EXISTS perf_snapshots (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  rss_mb REAL,
  heap_mb REAL,
  db_size_mb REAL,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);
