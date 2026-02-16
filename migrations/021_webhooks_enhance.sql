ALTER TABLE webhooks ADD COLUMN prompt_template TEXT;
ALTER TABLE webhooks ADD COLUMN last_triggered_at TEXT;
ALTER TABLE webhooks ADD COLUMN trigger_count INTEGER NOT NULL DEFAULT 0;
