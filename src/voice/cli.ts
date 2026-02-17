import { loadConfig } from "../config/loader";
import { ensureDirectories } from "../config/paths";
import { getDb, closeDb } from "../db/connection";
import { runMigrations } from "../db/migrations";
import { createProvider } from "../llm/factory";
import { initStt } from "./stt";
import { initTts } from "./tts";
import { VoiceConversation } from "./conversation";
import { agentLoop } from "../agent/loop";
import { searchMemory } from "../memory/engine";
import { initMemory } from "../memory/engine";
import { registerDatetimeTool } from "../tools/builtin/datetime";
import { registerMemoryWriteTool } from "../tools/builtin/memory-write";
import { registerMemorySearchTool } from "../tools/builtin/memory-search";
import { registerSecretTools } from "../tools/builtin/secrets";
import { loadSkills } from "../tools/skill-loader";
import { enableFileLogging, logger } from "../util/logger";
import { paths } from "../config/paths";

const VOICE_SESSION = "voice";

/**
 * CLI entry point for `zubo voice`.
 *
 * Initializes the minimum required subsystems (config, DB, LLM, memory, tools,
 * STT, TTS) then starts a continuous voice conversation loop.
 */
export async function startVoiceMode(): Promise<void> {
  enableFileLogging();
  logger.info("Starting Zubo voice mode...");

  // Load config
  const config = await loadConfig();
  ensureDirectories();

  // Check that voice is configured
  if (!config.voice?.stt) {
    console.error(
      "\nError: Voice STT not configured.\n\n" +
        "Add to ~/.zubo/config.json:\n\n" +
        '  "voice": {\n' +
        '    "stt": {\n' +
        '      "provider": "local",\n' +
        '      "binaryPath": "/path/to/whisper",\n' +
        '      "modelPath": "/path/to/ggml-base.en.bin"\n' +
        "    },\n" +
        '    "tts": {\n' +
        '      "provider": "openai",\n' +
        '      "apiKey": "sk-...",\n' +
        '      "voice": "alloy"\n' +
        "    }\n" +
        "  }\n\n" +
        "Supported STT providers: whisper (cloud OpenAI), local (whisper.cpp)\n" +
        "Supported TTS providers: openai, elevenlabs\n"
    );
    process.exit(1);
  }
  if (!config.voice?.tts) {
    console.error(
      "\nError: Voice TTS not configured.\n\n" +
        "Add a tts section to voice config in ~/.zubo/config.json.\n" +
        "Supported: openai, elevenlabs\n"
    );
    process.exit(1);
  }

  // Init DB
  const db = getDb();
  runMigrations(db);

  // Init memory
  console.log("  Initializing memory...");
  await initMemory(db);

  // Init LLM
  console.log("  Initializing LLM...");
  const llm = await createProvider(config);

  // Init STT + TTS
  console.log("  Initializing STT...");
  initStt(config.voice.stt);

  console.log("  Initializing TTS...");
  initTts(config.voice.tts);

  // Register core tools (voice mode has access to tools too)
  registerDatetimeTool();
  registerMemoryWriteTool();
  registerMemorySearchTool(db);
  registerSecretTools();

  // Load skills
  try {
    const skillNames = await loadSkills(paths.skills);
    if (skillNames.length) {
      logger.info(`Skills loaded: ${skillNames.join(", ")}`);
    }
  } catch (err: any) {
    logger.warn(`Failed to load skills: ${err.message}`);
  }

  // Conversation options from config
  const conversationOpts = config.voice.conversation;

  // Create voice conversation
  const conversation = new VoiceConversation({
    silenceThreshold: conversationOpts?.silenceThreshold ?? 1500,
    maxRecordingMs: conversationOpts?.maxRecordingMs ?? 30000,

    async onTranscript(text: string): Promise<string> {
      // Search memory for relevant context
      let memories = "";
      try {
        const results = searchMemory(db, text, 3);
        if (results.length > 0) {
          memories = results.map((r) => r.content).join("\n\n");
        }
      } catch (err: any) {
        if (!err.message?.includes("no such table")) {
          logger.warn("Memory search failed", { error: err.message });
        }
      }

      // Run through the full agent loop (with tools)
      const result = await agentLoop(llm, VOICE_SESSION, text, {
        memories,
        directUserRequest: true,
      });
      return result.reply;
    },

    onUserText(text: string) {
      console.log(`\n  You: ${text}`);
    },

    onAgentText(text: string) {
      console.log(`  Zubo: ${text}`);
    },

    onWarning(msg: string) {
      console.log(`  [!] ${msg}`);
    },
  });

  // Print banner
  console.log("\n" + "=".repeat(52));
  console.log("  Voice mode active. Speak to talk to Zubo.");
  console.log("  Press Ctrl+C to stop.");
  console.log("=".repeat(52) + "\n");

  // Graceful shutdown
  const shutdown = () => {
    console.log("\n  Stopping voice mode...");
    conversation.stop();
    closeDb();
    process.exit(0);
  };
  process.on("SIGINT", shutdown);
  process.on("SIGTERM", shutdown);

  // Start the voice loop (blocks until stopped)
  try {
    await conversation.start();
  } catch (err: any) {
    console.error(`\nVoice mode error: ${err.message}\n`);
    logger.error("Voice mode fatal error", { error: err.message });
    closeDb();
    process.exit(1);
  }
}
