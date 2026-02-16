CREATE TABLE IF NOT EXISTS email_digest_config (
  id INTEGER PRIMARY KEY CHECK (id = 1),
  enabled INTEGER NOT NULL DEFAULT 0,
  frequency TEXT NOT NULL DEFAULT 'daily',
  send_time TEXT NOT NULL DEFAULT '09:00',
  email_to TEXT,
  include_conversations INTEGER NOT NULL DEFAULT 1,
  include_tool_usage INTEGER NOT NULL DEFAULT 1,
  include_errors INTEGER NOT NULL DEFAULT 1,
  include_scheduled_tasks INTEGER NOT NULL DEFAULT 1,
  last_sent_at TEXT
);
INSERT OR IGNORE INTO email_digest_config (id) VALUES (1);
