import { loadConfig } from "./config/loader";
import { ensureDirectories } from "./config/paths";
import { getDb, closeDb } from "./db/connection";
import { runMigrations } from "./db/migrations";
import { ClaudeProvider } from "./llm/claude";
import { registerDatetimeTool } from "./tools/builtin/datetime";
import { registerMemoryWriteTool } from "./tools/builtin/memory-write";
import { registerMemorySearchTool } from "./tools/builtin/memory-search";
import { createTelegramAdapter } from "./channels/telegram";
import { createRouter } from "./channels/router";
import { startHeartbeat } from "./scheduler/heartbeat";
import { initCronScheduler } from "./scheduler/cron";
import { initMemory } from "./memory/engine";
import { logger } from "./util/logger";

export async function startOrba() {
  logger.info("Starting Orba...");

  // Load config
  const config = await loadConfig();
  ensureDirectories();

  // Init DB
  const db = getDb();
  runMigrations(db);

  // Init memory (embedder + index existing files)
  logger.info("Initializing memory system...");
  await initMemory(db);

  // Init LLM
  const llm = new ClaudeProvider(config.anthropicApiKey, config.model);

  // Register tools
  registerDatetimeTool();
  registerMemoryWriteTool();
  registerMemorySearchTool(db);

  // Create message router
  const router = createRouter(llm, db);

  // Start Telegram
  const telegram = createTelegramAdapter(config.telegramBotToken, config, router);
  telegram.start();
  logger.info("Telegram bot started");

  // Start scheduler
  startHeartbeat();
  initCronScheduler(db, router);
  logger.info("Scheduler started");

  logger.info("Orba is running. Press Ctrl+C to stop.");

  // Graceful shutdown
  const shutdown = () => {
    logger.info("Shutting down...");
    telegram.stop();
    closeDb();
    process.exit(0);
  };
  process.on("SIGINT", shutdown);
  process.on("SIGTERM", shutdown);
}
