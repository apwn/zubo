CREATE TABLE IF NOT EXISTS conversation_messages (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  thread_id TEXT NOT NULL,
  role TEXT NOT NULL,
  content TEXT NOT NULL,
  channel TEXT,
  timestamp TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX idx_conv_msg_thread ON conversation_messages(thread_id);
CREATE INDEX idx_conv_msg_ts ON conversation_messages(timestamp DESC);
CREATE VIRTUAL TABLE IF NOT EXISTS conversation_search USING fts5(content, thread_id UNINDEXED, role UNINDEXED);
ALTER TABLE threads ADD COLUMN channel TEXT DEFAULT 'webchat';
ALTER TABLE threads ADD COLUMN message_count INTEGER DEFAULT 0;
ALTER TABLE threads ADD COLUMN summary TEXT;
