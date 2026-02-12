import { existsSync, readFileSync, unlinkSync, writeFileSync } from "fs";
import { loadConfig } from "./config/loader";
import { ensureDirectories, paths } from "./config/paths";
import type { ZuboConfig } from "./config/schema";
import { getDb, closeDb } from "./db/connection";
import { runMigrations } from "./db/migrations";
import { createProvider } from "./llm/factory";
import { registerDatetimeTool } from "./tools/builtin/datetime";
import { registerMemoryWriteTool } from "./tools/builtin/memory-write";
import { registerMemorySearchTool } from "./tools/builtin/memory-search";
import { registerManageSkillsTool } from "./tools/builtin/manage-skills";
import { registerCronTools } from "./tools/builtin/cron";
import { registerSecretTools } from "./tools/builtin/secrets";
import { registerConnectServiceTool } from "./tools/builtin/connect-service";
import { registerDelegateTool } from "./tools/builtin/delegate";
import { registerManageAgentsTool } from "./tools/builtin/manage-agents";
import { exposeSecretsRuntime } from "./secrets/store";
import { loadSkills } from "./tools/skill-loader";
import { createRouter, type MessageRouter } from "./channels/router";
import { startHeartbeat } from "./scheduler/heartbeat";
import { initCronScheduler } from "./scheduler/cron";
import { initMemory } from "./memory/engine";
import { logger, enableFileLogging } from "./util/logger";

function openBrowser(url: string) {
  try {
    const cmd =
      process.platform === "darwin"
        ? ["open", url]
        : process.platform === "win32"
          ? ["cmd", "/c", "start", url]
          : ["xdg-open", url];
    Bun.spawn(cmd, { stdio: ["ignore", "ignore", "ignore"] });
  } catch {}
}

function getTelegramToken(config: ZuboConfig): string | null {
  if (config.channels?.telegram?.enabled !== false && config.channels?.telegram?.botToken) {
    return config.channels.telegram.botToken;
  }
  // Legacy fallback
  if (config.telegramBotToken) {
    return config.telegramBotToken;
  }
  return null;
}

function getTelegramAllowedUsers(config: ZuboConfig): number[] {
  if (config.channels?.telegram?.allowedUsers?.length) {
    return config.channels.telegram.allowedUsers;
  }
  return config.telegramAllowedUsers ?? [];
}

async function startChannels(config: ZuboConfig, router: MessageRouter) {
  const stoppers: (() => void)[] = [];

  // Telegram
  const tgToken = getTelegramToken(config);
  if (tgToken) {
    const { createTelegramAdapter } = await import("./channels/telegram");
    // Build a compat config object for the telegram adapter
    const tgConfig = {
      ...config,
      telegramBotToken: tgToken,
      telegramAllowedUsers: getTelegramAllowedUsers(config),
    };
    const telegram = createTelegramAdapter(tgToken, tgConfig, router);
    router.addAdapter(telegram);
    telegram.start();
    stoppers.push(() => telegram.stop());
    logger.info("Telegram channel started");
  }

  // Discord
  if (config.channels?.discord?.enabled !== false && config.channels?.discord?.botToken) {
    const { createDiscordAdapter } = await import("./channels/discord");
    const discord = createDiscordAdapter(
      config.channels.discord.botToken,
      config.channels.discord.allowedUsers ?? [],
      router
    );
    router.addAdapter(discord);
    discord.start();
    stoppers.push(() => discord.stop());
    logger.info("Discord channel started");
  }

  // WebChat + Dashboard (always enabled)
  if (config.channels?.webchat?.enabled !== false) {
    const requestedPort = config.channels?.webchat?.port ?? 0;
    const { createWebChatAdapter } = await import("./channels/webchat");
    const webchat = createWebChatAdapter(requestedPort, router);
    router.addAdapter(webchat);
    webchat.start();
    stoppers.push(() => webchat.stop());

    // Print URLs with the actual resolved port and auto-open browser
    const actualPort = webchat.getPort();
    const url = `http://localhost:${actualPort}`;
    console.log(`\n  Chat:      ${url}`);
    console.log(`  Dashboard: ${url}/dashboard\n`);
    openBrowser(url);
  }

  return () => {
    for (const stop of stoppers) stop();
  };
}

export async function startZubo(isDaemon = false) {
  if (isDaemon) {
    return startDaemon();
  }

  enableFileLogging();
  logger.info("Starting Zubo...");

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
  const llm = createProvider(config);

  // Register tools
  registerDatetimeTool();
  registerMemoryWriteTool();
  registerMemorySearchTool(db);
  registerManageSkillsTool();
  registerSecretTools();
  exposeSecretsRuntime();
  registerConnectServiceTool();

  // Load skills
  try {
    const skillNames = await loadSkills(paths.skills);
    if (skillNames.length) {
      logger.info(`Skills loaded: ${skillNames.join(", ")}`);
    } else {
      logger.info("No skills found in workspace");
    }
  } catch (err: any) {
    logger.error(`Failed to load skills: ${err.message}`);
  }

  // Create message router
  const router = createRouter(llm, db);

  // Register cron tools (need router for scheduling)
  registerCronTools(db, router, config, llm);

  // Register delegation tools
  registerDelegateTool(llm);
  registerManageAgentsTool();

  // Start all configured channels
  const stopChannels = await startChannels(config, router);

  // Start scheduler
  startHeartbeat();
  initCronScheduler(db, router, config, llm);
  logger.info("Scheduler started");

  logger.info("Zubo is running. Press Ctrl+C to stop.");

  // Graceful shutdown
  const shutdown = () => {
    logger.info("Shutting down...");
    stopChannels();
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

  console.log(`Zubo started in background (PID ${pid})`);
  console.log(`Logs: ${paths.logFile}`);
  console.log(`Stop: bun run stop`);

  // Unref so parent can exit
  child.unref();
  process.exit(0);
}

export function stopDaemon() {
  if (!existsSync(paths.pidFile)) {
    console.log("Zubo is not running (no PID file found).");
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
    console.log(`Sent SIGTERM to Zubo (PID ${pid}).`);
  } catch {
    console.log(`Process ${pid} is not running. Cleaning up PID file.`);
  }

  try {
    unlinkSync(paths.pidFile);
  } catch {}
}
