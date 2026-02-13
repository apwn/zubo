import { existsSync, readFileSync, unlinkSync, writeFileSync, mkdirSync } from "fs";
import { join } from "path";
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
import { registerDelegateTaskTool } from "./tools/builtin/delegate-task";
import { registerDiagnoseTool } from "./tools/builtin/diagnose";
import { registerGoogleOAuthTool } from "./tools/builtin/google-oauth";
import { registerManageAgentsTool } from "./tools/builtin/manage-agents";
import { exposeSecretsRuntime } from "./secrets/store";
import { loadSkills, watchSkills } from "./tools/skill-loader";
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
  } catch (err: any) {
    logger.warn("Failed to open browser", { error: (err as Error).message });
  }
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

  // Slack
  if (config.channels?.slack?.enabled !== false && config.channels?.slack?.botToken) {
    const { createSlackAdapter } = await import("./channels/slack");
    const slack = createSlackAdapter(
      config.channels.slack.botToken,
      config.channels.slack.appToken,
      config.channels.slack.allowedUsers ?? [],
      router
    );
    router.addAdapter(slack);
    slack.start();
    stoppers.push(() => slack.stop());
    logger.info("Slack channel started");
  }

  // WhatsApp
  if (config.channels?.whatsapp?.enabled !== false && config.channels?.whatsapp) {
    const { createWhatsAppAdapter } = await import("./channels/whatsapp");
    const whatsapp = createWhatsAppAdapter(
      config.channels.whatsapp.allowedNumbers ?? [],
      config.channels.whatsapp.authDir,
      router
    );
    router.addAdapter(whatsapp);
    whatsapp.start();
    stoppers.push(() => whatsapp.stop());
    logger.info("WhatsApp channel started");
  }

  // Signal
  if (config.channels?.signal?.enabled !== false && config.channels?.signal?.phoneNumber) {
    const { createSignalAdapter } = await import("./channels/signal");
    const signal = createSignalAdapter(
      config.channels.signal.phoneNumber,
      config.channels.signal.allowedNumbers ?? [],
      config.channels.signal.signalCliPath,
      router
    );
    router.addAdapter(signal);
    signal.start();
    stoppers.push(() => signal.stop());
    logger.info("Signal channel started");
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

  // Init voice (STT/TTS) if configured
  if (config.voice?.stt) {
    const { initStt } = await import("./voice/stt");
    initStt(config.voice.stt);
  }
  if (config.voice?.tts) {
    const { initTts } = await import("./voice/tts");
    initTts(config.voice.tts);
  }

  // Register tools
  registerDatetimeTool();
  registerMemoryWriteTool();
  registerMemorySearchTool(db);
  registerManageSkillsTool();
  registerSecretTools();
  exposeSecretsRuntime();
  registerConnectServiceTool();

  // Register skill registry tool
  const { registerSkillRegistryTool } = await import("./tools/builtin/skill-registry");
  registerSkillRegistryTool();

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

  // Start skill hot-reload watcher
  const stopSkillWatcher = watchSkills();

  // Create message router
  const router = createRouter(llm, db);

  // Register cron tools (need router for scheduling)
  registerCronTools(db, router, config, llm);

  // Register delegation tools
  registerDelegateTool(llm);
  registerDelegateTaskTool(llm);
  registerManageAgentsTool();

  // Register diagnostics
  registerDiagnoseTool();

  // Register Google OAuth tool
  registerGoogleOAuthTool();

  // Register workflow + team tools
  const { registerManageWorkflowsTool } = await import("./tools/builtin/manage-workflows");
  const { registerRunWorkflowTool } = await import("./tools/builtin/run-workflow");
  const { registerManageTeamsTool } = await import("./tools/builtin/manage-teams");
  registerManageWorkflowsTool();
  registerRunWorkflowTool(llm);
  registerManageTeamsTool();

  // Register proactive intelligence tools
  const { registerManageTriggersTool } = await import("./tools/builtin/manage-triggers");
  registerManageTriggersTool();

  // Start all configured channels
  const stopChannels = await startChannels(config, router);

  // Start scheduler
  startHeartbeat(config.heartbeatMinutes);
  initCronScheduler(db, router, config, llm);
  logger.info("Scheduler started");

  // Register daily backup handler
  const { onHeartbeat } = await import("./scheduler/heartbeat");
  const { backupDatabase } = await import("./db/export");
  let lastBackupDay = "";
  onHeartbeat(async () => {
    const today = new Date().toISOString().slice(0, 10);
    if (today === lastBackupDay) return;
    try {
      const backupDir = join(paths.workspace, "backups");
      mkdirSync(backupDir, { recursive: true });
      backupDatabase(paths.db, backupDir);
      lastBackupDay = today;
      // Prune old backups — keep last 7
      const { readdirSync: ls, unlinkSync: rm } = await import("fs");
      const files = ls(backupDir).filter((f: string) => f.startsWith("zubo-backup-")).sort();
      while (files.length > 7) {
        rm(join(backupDir, files.shift()!));
      }
      logger.info("Daily backup complete");
    } catch (err: any) {
      logger.warn("Daily backup failed", { error: err.message });
    }
  });

  // Init proactive intelligence
  const { initProactiveIntelligence } = await import("./scheduler/proactive");
  initProactiveIntelligence(db, router, llm, config);

  // Ensure morning briefing cron exists
  const { ensureBriefingCron } = await import("./scheduler/briefing");
  ensureBriefingCron(db);

  // Init performance collector
  const { initPerfCollector } = await import("./util/perf-collector");
  initPerfCollector();

  logger.info("Zubo is running. Press Ctrl+C to stop.");

  // Graceful shutdown
  const shutdown = () => {
    logger.info("Shutting down...");
    stopSkillWatcher();
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
  } catch (err: any) {
    logger.warn("Failed to clean up PID file", { error: (err as Error).message });
  }
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
  } catch (err: any) {
    logger.warn("Failed to remove PID file", { error: (err as Error).message });
  }
}
