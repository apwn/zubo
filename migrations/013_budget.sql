-- Budget configuration
CREATE TABLE IF NOT EXISTS budget_config (
  id INTEGER PRIMARY KEY CHECK (id = 1), -- singleton row
  daily_limit_usd REAL,
  monthly_limit_usd REAL,
  alert_threshold REAL DEFAULT 0.8, -- alert at 80% of budget
  paused INTEGER NOT NULL DEFAULT 0, -- 1 = budget exceeded, agent paused
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);

INSERT OR IGNORE INTO budget_config (id) VALUES (1);
