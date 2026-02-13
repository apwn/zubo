-- Performance indexes for dashboard analytics queries
CREATE INDEX IF NOT EXISTS idx_usage_provider_model ON usage(provider, model);
CREATE INDEX IF NOT EXISTS idx_tool_metrics_name ON tool_metrics(tool_name);
CREATE INDEX IF NOT EXISTS idx_tool_metrics_created ON tool_metrics(created_at);
CREATE INDEX IF NOT EXISTS idx_memory_chunks_source ON memory_chunks(source_file);
