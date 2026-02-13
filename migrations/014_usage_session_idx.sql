-- Index on usage.session_id for analytics queries using COUNT(DISTINCT session_id)
CREATE INDEX IF NOT EXISTS idx_usage_session_id ON usage(session_id);
