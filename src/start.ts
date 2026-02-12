import { existsSync, readFileSync, unlinkSync, writeFileSync } from "fs";
import { loadConfig } from "./config/loader";
import { ensureDirectories, paths } from "./config/paths";
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
import { logger, enableFileLogging } from "./util/logger";

export async function startOrba(isDaemon = false) {
  if (isDaemon) {
    return startDaemon();
  }

  enableFileLogging();
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

  // Start Telegram and wire adapter into router for proactive messaging
  const telegram = createTelegramAdapter(config.telegramBotToken, config, router);
  router.setAdapter(telegram);
  telegram.start();
  logger.info("Telegram bot started");

  // Start scheduler
  startHeartbeat();
  initCronScheduler(db, router, config);
  logger.info("Scheduler started");

  logger.info("Orba is running. Press Ctrl+C to stop.");

  // Graceful shutdown
  const shutdown = () => {
    logger.info("Shutting down...");
    telegram.stop();
    closeDb();
    cleanupPidFile();
    process.exit(0);
  };
  process.on("SIGINT", shutdown);
  process.on("SIGTERM", shutdown);
}

function cleanupPidFile() {
  try {
    if (existsSync(paths.pidFile)) unlinkSync(paths.pidFile);
  } catch {}
}

function startDaemon() {
  ensureDirectories();

  // Spawn detached child process
  const child = Bun.spawn(["bun", "run", "src/index.ts", "start"], {
    cwd: import.meta.dir.replace(/\/src$/, ""),
    stdio: ["ignore", "ignore", "ignore"],
    env: { ...process.env },
  });

  // Write child PID
  const pid = child.pid;
  writeFileSync(paths.pidFile, String(pid));

  console.log(`Orba started in background (PID ${pid})`);
  console.log(`Logs: ${paths.logFile}`);
  console.log(`Stop: bun run stop`);

  // Unref so parent can exit
  child.unref();
  process.exit(0);
}

export function stopDaemon() {
  if (!existsSync(paths.pidFile)) {
    console.log("Orba is not running (no PID file found).");
    return;
  }

  const pid = parseInt(readFileSync(paths.pidFile, "utf-8").trim(), 10);

  if (isNaN(pid)) {
    console.log("Invalid PID file. Removing it.");
    unlinkSync(paths.pidFile);
    return;
  }

  try {
    process.kill(pid, 0); // check if alive
    process.kill(pid, "SIGTERM");
    console.log(`Sent SIGTERM to Orba (PID ${pid}).`);
  } catch {
    console.log(`Process ${pid} is not running. Cleaning up PID file.`);
  }

  try {
    unlinkSync(paths.pidFile);
  } catch {}
}
