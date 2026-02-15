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
import { exposeSecretsRuntime, exposeGoogleTokenRuntime, exposeOAuthTokenRuntime } from "./secrets/store";
import { registerTool } from "./tools/registry";
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

async function startChannels(config: ZuboConfig, router: MessageRouter) {
  const { startChannel } = await import("./channels/lifecycle");
  const stoppers: (() => void)[] = [];

  // Start all configured channels via lifecycle manager
  const channelNames = ["telegram", "discord", "slack", "whatsapp", "signal", "email"];
  for (const name of channelNames) {
    const ch = (config.channels as any)?.[name];
    const isEnabled = ch?.enabled !== false;
    const isConfigured =
      name === "telegram" ? !!(ch?.botToken || config.telegramBotToken) :
      name === "discord" ? !!ch?.botToken :
      name === "slack" ? !!ch?.botToken :
      name === "whatsapp" ? !!ch :
      name === "signal" ? !!ch?.phoneNumber :
      name === "email" ? !!ch?.imap?.host :
      false;

    if (isEnabled && isConfigured) {
      await startChannel(name, config, router);
    }
  }

  // WebChat + Dashboard (always enabled, NOT managed by lifecycle — it hosts the dashboard)
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

  // Expose Google OAuth token helper for installed skill handlers
  const { getGoogleAccessToken } = await import("./util/google-tokens");
  exposeGoogleTokenRuntime(getGoogleAccessToken);

  // Expose multi-provider OAuth token helper for skill handlers
  const { getOAuthTokenForIntegration } = await import("./tools/oauth");
  exposeOAuthTokenRuntime(getOAuthTokenForIntegration);

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

  // Expose router on globalThis so dashboard API endpoints can access it for hot-reload
  (globalThis as any).__zuboRouter = router;

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

  // Register OAuth management tool (multi-provider)
  const oauthManageHandler = (await import("./tools/builtin-skills/oauth-manage/handler")).default;
  registerTool({
    definition: {
      name: "oauth_manage",
      description:
        "Manage OAuth connections for third-party integrations (Google, GitHub, Notion, Linear, Slack). " +
        "Use action 'list' to see all connections and their status. " +
        "Use 'connect' with a provider name to get an authorization URL. " +
        "Use 'disconnect' to revoke access. Use 'status' to check a specific provider.",
      input_schema: {
        type: "object",
        properties: {
          action: {
            type: "string",
            enum: ["list", "connect", "disconnect", "status"],
            description: "The action to perform.",
          },
          provider: {
            type: "string",
            enum: ["google", "github", "notion", "linear", "slack"],
            description: "The OAuth provider name. Required for connect, disconnect, and status.",
          },
        },
        required: ["action"],
      },
    },
    execute: oauthManageHandler,
  });
  logger.info("OAuth management tool registered");

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

  // Register code interpreter tool
  if (config.codeInterpreter?.enabled !== false) {
    const codeInterpreterHandler = (await import("./tools/builtin-skills/code-interpreter/handler")).default;
    registerTool({
      definition: {
        name: "code_interpreter",
        description: "Execute Python, JavaScript, or TypeScript code in a sandboxed subprocess and return the output. Use this to run calculations, data processing, text manipulation, or any code the user requests.",
        input_schema: {
          type: "object",
          properties: {
            code: { type: "string", description: "The code to execute" },
            language: { type: "string", enum: ["python", "javascript", "typescript"], description: "Programming language to use" },
          },
          required: ["code", "language"],
        },
      },
      execute: codeInterpreterHandler,
    });
    logger.info("Code interpreter tool registered");
  }

  // Register image generation tool (if configured)
  if (config.imageGeneration?.provider) {
    const imageGenHandler = (await import("./tools/builtin-skills/image-generate/handler")).default;
    registerTool({
      definition: {
        name: "image_generate",
        description: "Generate images using AI models (DALL-E 3, Flux, or Together AI). Returns the file path of the generated image.",
        input_schema: {
          type: "object",
          properties: {
            prompt: { type: "string", description: "Text description of the image to generate" },
            size: { type: "string", description: "Image size (e.g. '1024x1024'). Default: 1024x1024" },
            style: { type: "string", enum: ["vivid", "natural"], description: "Image style. Default: vivid" },
            n: { type: "number", description: "Number of images (1-4). Default: 1" },
          },
          required: ["prompt"],
        },
      },
      execute: imageGenHandler,
    });
    logger.info("Image generation tool registered");
  }

  // Register knowledge graph tools
  const kgQueryHandler = (await import("./tools/builtin-skills/kg-query/handler")).default;
  const kgUpdateHandler = (await import("./tools/builtin-skills/kg-update/handler")).default;
  registerTool({
    definition: {
      name: "kg_query",
      description: "Query the knowledge graph to find entities, their relationships, and structured information. Use this to recall known people, projects, concepts, and how they relate to each other.",
      input_schema: {
        type: "object",
        properties: {
          action: { type: "string", enum: ["search", "get", "relations", "graph"], description: "Action to perform" },
          name: { type: "string", description: "Entity name (for get, relations)" },
          type: { type: "string", description: "Entity type filter" },
          query: { type: "string", description: "Search query (for search)" },
          relation: { type: "string", description: "Relation type filter" },
          direction: { type: "string", enum: ["outgoing", "incoming", "both"], description: "Relation direction" },
        },
        required: ["action"],
      },
    },
    execute: kgQueryHandler,
  });
  registerTool({
    definition: {
      name: "kg_update",
      description: "Update the knowledge graph by adding or removing entities and relationships. Use this to build structured memory about people, projects, concepts, and their connections.",
      input_schema: {
        type: "object",
        properties: {
          action: { type: "string", enum: ["add_entity", "add_relation", "remove_entity", "remove_relation"], description: "Action to perform" },
          name: { type: "string", description: "Entity name" },
          type: { type: "string", description: "Entity type (person, project, concept, etc.)" },
          properties: { type: "object", description: "Key-value properties" },
          source_name: { type: "string", description: "Source entity name" },
          source_type: { type: "string", description: "Source entity type" },
          target_name: { type: "string", description: "Target entity name" },
          target_type: { type: "string", description: "Target entity type" },
          relation: { type: "string", description: "Relation type" },
        },
        required: ["action"],
      },
    },
    execute: kgUpdateHandler,
  });
  logger.info("Knowledge graph tools registered");

  // Register webhook management tool
  const webhookManageHandler = (await import("./tools/builtin-skills/webhook-manage/handler")).default;
  registerTool({
    definition: {
      name: "webhook_manage",
      description: "Manage webhook endpoints that let external services (GitHub, Stripe, CI/CD, etc.) send events to Zubo. Create, list, delete, and toggle webhooks.",
      input_schema: {
        type: "object",
        properties: {
          action: { type: "string", enum: ["create", "list", "delete", "toggle"], description: "Action to perform" },
          name: { type: "string", description: "Webhook name" },
          description: { type: "string", description: "Webhook description" },
          secret: { type: "string", description: "HMAC secret for verification" },
        },
        required: ["action"],
      },
    },
    execute: webhookManageHandler,
  });
  logger.info("Webhook management tool registered");

  // Start all configured channels
  const stopChannels = await startChannels(config, router);

  // Initialize MCP servers (if configured)
  let mcpDisconnect: (() => Promise<void>) | null = null;
  if (config.mcp?.servers?.length) {
    const { initMcpServers, disconnectAllMcp } = await import("./tools/mcp-client");
    try {
      await initMcpServers(config.mcp.servers);
      mcpDisconnect = disconnectAllMcp;
      logger.info("MCP servers initialized");
    } catch (err: any) {
      logger.error("Failed to initialize MCP servers", { error: err.message });
    }
  }

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
  const shutdown = async () => {
    logger.info("Shutting down...");
    stopSkillWatcher();
    stopChannels();
    if (mcpDisconnect) {
      try { await mcpDisconnect(); } catch {}
    }
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
