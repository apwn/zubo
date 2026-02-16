CREATE TABLE IF NOT EXISTS visual_workflows (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  description TEXT,
  trigger_type TEXT NOT NULL,
  trigger_config TEXT NOT NULL,
  steps TEXT NOT NULL,
  canvas_data TEXT,
  enabled INTEGER NOT NULL DEFAULT 1,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now')),
  last_run_at TEXT,
  run_count INTEGER NOT NULL DEFAULT 0
);
