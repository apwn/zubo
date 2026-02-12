CREATE TABLE IF NOT EXISTS workflow_executions (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  workflow_name TEXT NOT NULL,
  input TEXT,
  status TEXT NOT NULL DEFAULT 'running',
  result TEXT,
  started_at TEXT NOT NULL DEFAULT (datetime('now')),
  completed_at TEXT
);

CREATE TABLE IF NOT EXISTS workflow_step_logs (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  execution_id INTEGER NOT NULL REFERENCES workflow_executions(id),
  step_name TEXT NOT NULL,
  agent_name TEXT NOT NULL,
  task TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending',
  output TEXT,
  started_at TEXT,
  completed_at TEXT,
  duration_ms INTEGER
);
