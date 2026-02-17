CREATE TABLE IF NOT EXISTS sent_messages (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  provider TEXT NOT NULL, -- smtp | gmail | email_channel
  recipient TEXT NOT NULL,
  subject TEXT NOT NULL,
  body_preview TEXT,
  attachments_json TEXT,
  status TEXT NOT NULL, -- sent | failed
  error_message TEXT,
  external_id TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_sent_messages_created_at
  ON sent_messages(created_at DESC);

CREATE INDEX IF NOT EXISTS idx_sent_messages_recipient
  ON sent_messages(recipient);
