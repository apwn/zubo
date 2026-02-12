import { paths, ensureDirectories } from "./config/paths";
import { saveConfig } from "./config/loader";
import { configSchema } from "./config/schema";
import type { ProviderConfig } from "./config/schema";
import { getDb } from "./db/connection";
import { runMigrations } from "./db/migrations";
import { logger } from "./util/logger";
import { existsSync } from "fs";
import { installBuiltinSkills } from "./tools/skill-installer";

async function prompt(question: string): Promise<string> {
  process.stdout.write(question);
  for await (const line of console) {
    return line.trim();
  }
  return "";
}

interface ProviderOption {
  key: string;
  label: string;
  setup: () => Promise<{ name: string; config: ProviderConfig }>;
}

const PROVIDER_OPTIONS: ProviderOption[] = [
  {
    key: "1",
    label: "Anthropic (Claude)",
    setup: async () => {
      const apiKey = await prompt("Anthropic API key (sk-ant-...): ");
      if (!apiKey.startsWith("sk-ant-")) {
        console.log("Warning: Key doesn't start with 'sk-ant-'. Proceeding anyway.");
      }
      const model = await prompt("Model [claude-sonnet-4-5-20250929]: ");
      return {
        name: "anthropic",
        config: { apiKey, model: model || "claude-sonnet-4-5-20250929" },
      };
    },
  },
  {
    key: "2",
    label: "OpenAI (GPT)",
    setup: async () => {
      const apiKey = await prompt("OpenAI API key (sk-...): ");
      const model = await prompt("Model [gpt-4o]: ");
      return {
        name: "openai",
        config: { apiKey, model: model || "gpt-4o" },
      };
    },
  },
  {
    key: "3",
    label: "Ollama (local)",
    setup: async () => {
      const baseUrl = await prompt("Ollama URL [http://localhost:11434/v1]: ");
      const model = await prompt("Model [llama3.3]: ");
      return {
        name: "ollama",
        config: {
          baseUrl: baseUrl || "http://localhost:11434/v1",
          apiKey: "ollama",
          model: model || "llama3.3",
          streaming: false,
        },
      };
    },
  },
  {
    key: "4",
    label: "Groq",
    setup: async () => {
      const apiKey = await prompt("Groq API key (gsk_...): ");
      const model = await prompt("Model [llama-3.3-70b-versatile]: ");
      return {
        name: "groq",
        config: { apiKey, model: model || "llama-3.3-70b-versatile" },
      };
    },
  },
  {
    key: "5",
    label: "Together AI",
    setup: async () => {
      const apiKey = await prompt("Together API key: ");
      const model = await prompt("Model [meta-llama/Llama-3.3-70B-Instruct-Turbo]: ");
      return {
        name: "together",
        config: {
          apiKey,
          baseUrl: "https://api.together.xyz/v1",
          model: model || "meta-llama/Llama-3.3-70B-Instruct-Turbo",
        },
      };
    },
  },
  {
    key: "6",
    label: "OpenRouter",
    setup: async () => {
      const apiKey = await prompt("OpenRouter API key: ");
      const model = await prompt("Model [anthropic/claude-sonnet-4-5]: ");
      return {
        name: "openrouter",
        config: {
          apiKey,
          baseUrl: "https://openrouter.ai/api/v1",
          model: model || "anthropic/claude-sonnet-4-5",
        },
      };
    },
  },
  {
    key: "7",
    label: "LM Studio (local)",
    setup: async () => {
      const baseUrl = await prompt("LM Studio URL [http://localhost:1234/v1]: ");
      const model = await prompt("Model name: ");
      return {
        name: "lmstudio",
        config: {
          baseUrl: baseUrl || "http://localhost:1234/v1",
          apiKey: "lm-studio",
          model: model || "default",
        },
      };
    },
  },
  {
    key: "8",
    label: "Other (OpenAI-compatible)",
    setup: async () => {
      const name = await prompt("Provider name: ");
      const baseUrl = await prompt("Base URL (e.g. https://api.example.com/v1): ");
      const apiKey = await prompt("API key (or 'none'): ");
      const model = await prompt("Model name: ");
      return {
        name: name || "custom",
        config: {
          baseUrl,
          apiKey: apiKey === "none" ? undefined : apiKey,
          model: model || "default",
        },
      };
    },
  },
];

function printProviderMenu() {
  for (const opt of PROVIDER_OPTIONS) {
    console.log(`  ${opt.key}. ${opt.label}`);
  }
  console.log("");
}

async function pickProvider(): Promise<{ name: string; config: ProviderConfig } | null> {
  const maxKey = PROVIDER_OPTIONS.length;
  const choice = await prompt(`Provider [1-${maxKey}]: `);
  const option = PROVIDER_OPTIONS.find((o) => o.key === choice);
  if (!option) return null;
  console.log("");
  return option.setup();
}

async function setupProvider(): Promise<{
  providers: Record<string, ProviderConfig>;
  activeProvider: string;
  anthropicApiKey?: string;
}> {
  console.log("Choose your LLM provider:\n");
  printProviderMenu();

  const result = await pickProvider();
  if (!result) {
    console.log("Invalid choice. Defaulting to Anthropic.\n");
    const apiKey = await prompt("Anthropic API key (sk-ant-...): ");
    const model = "claude-sonnet-4-5-20250929";
    return {
      providers: { anthropic: { apiKey, model } },
      activeProvider: "anthropic",
      anthropicApiKey: apiKey,
    };
  }

  const providers: Record<string, ProviderConfig> = {
    [result.name]: result.config,
  };
  const anthropicApiKey =
    result.name === "anthropic" ? result.config.apiKey : undefined;

  console.log(`\n✓ ${result.name} configured (${result.config.model})`);

  // Offer to add a fallback
  const addFallback = await prompt("\nAdd a fallback provider? (y/N): ");
  if (addFallback.toLowerCase() === "y") {
    console.log("\nFallback provider:\n");
    printProviderMenu();
    const fb = await pickProvider();
    if (fb) {
      providers[fb.name] = fb.config;
      console.log(`✓ ${fb.name} added as fallback (${fb.config.model})`);
    }
  }

  return { providers, activeProvider: result.name, anthropicApiKey };
}

async function setupChannels(): Promise<{
  channels: Record<string, any>;
  telegramBotToken?: string;
}> {
  console.log("Which channels do you want to enable?\n");
  console.log("  1. Telegram");
  console.log("  2. Discord");
  console.log("  3. WebChat (local browser UI)");
  console.log("");
  console.log("Enter numbers separated by commas, e.g. 1,3\n");

  const choices = await prompt("Channels [1]: ");
  const selected = choices
    ? choices.split(",").map((s) => s.trim())
    : ["1"];

  const channels: Record<string, any> = {};
  let telegramBotToken: string | undefined;

  if (selected.includes("1")) {
    console.log("\nTo create a Telegram bot:");
    console.log("  1. Open Telegram and message @BotFather");
    console.log("  2. Send /newbot and follow the prompts");
    console.log("  3. Copy the bot token\n");
    const token = await prompt("Telegram bot token: ");
    channels.telegram = { enabled: true, botToken: token, allowedUsers: [] };
    telegramBotToken = token;
    console.log("✓ Telegram configured");
  }

  if (selected.includes("2")) {
    console.log("\nTo create a Discord bot:");
    console.log("  1. Go to https://discord.com/developers/applications");
    console.log("  2. Create an application → Bot → copy token");
    console.log("  3. Enable MESSAGE CONTENT intent");
    console.log("  4. Invite bot with messages scope\n");
    const token = await prompt("Discord bot token: ");
    channels.discord = { enabled: true, botToken: token, allowedUsers: [] };
    console.log("✓ Discord configured");
  }

  if (selected.includes("3")) {
    const portStr = await prompt("\nWebChat port [auto]: ");
    const port = parseInt(portStr, 10) || 0;
    channels.webchat = { enabled: true, port };
    console.log(`✓ WebChat configured${port ? ` on port ${port}` : " (auto port)"}`);
  }

  if (Object.keys(channels).length === 0) {
    console.log("\nNo channels selected. Defaulting to WebChat (auto port).");
    channels.webchat = { enabled: true, port: 0 };
  }

  return { channels, telegramBotToken };
}

export async function runSetup() {
  console.log("\n  Zubo Setup Wizard\n");
  console.log("This will configure your Zubo agent.\n");

  // 1. LLM provider
  const { providers, activeProvider, anthropicApiKey } = await setupProvider();

  // Build failover list from extra providers
  const failover = Object.keys(providers).filter((k) => k !== activeProvider);

  // 2. Channels
  const { channels, telegramBotToken } = await setupChannels();

  // 3. Create directory tree
  console.log("\nCreating ~/.zubo/ directory tree...");
  ensureDirectories();

  // 4. Write config
  const config = configSchema.parse({
    // Legacy compat
    anthropicApiKey,
    model: providers[activeProvider].model,
    telegramBotToken,
    telegramAllowedUsers: [],

    // New provider system
    providers,
    activeProvider,
    failover: failover.length ? failover : undefined,

    // Channels
    channels,
  });
  await saveConfig(config);
  console.log(`Config saved to ${paths.config}`);

  // 5. Init SQLite DB
  console.log("Initializing database...");
  const db = getDb();
  runMigrations(db);
  db.close();
  console.log(`Database created at ${paths.db}`);

  // 6. Create initial MEMORY.md
  if (!existsSync(paths.memoryFile)) {
    await Bun.write(
      paths.memoryFile,
      `# Zubo Memory\n\nThis file stores persistent memories about the user.\n`
    );
    console.log(`Created ${paths.memoryFile}`);
  }

  // 7. Create default SYSTEM.md
  if (!existsSync(paths.systemPrompt)) {
    await Bun.write(
      paths.systemPrompt,
      `You are Zubo, a personal AI agent. You are helpful, proactive, and have a persistent memory.

## Your capabilities
- You remember things about the user across conversations using your memory tools.
- You can check the current date and time.
- You are conversational and friendly, but concise.
- When the user tells you something personal (name, preferences, facts about their life), proactively save it to memory.
- When answering questions that might relate to stored memories, search your memory first.

## Guidelines
- Be concise. Don't over-explain unless asked.
- Use memory_write to save important facts the user shares.
- Use memory_search to recall previously stored information.
- If you're unsure about something, say so.
`
    );
    console.log(`Created ${paths.systemPrompt}`);
  }

  // 8. Install built-in skills
  const installed = installBuiltinSkills(paths.skills);
  if (installed.length) {
    console.log(`Installed ${installed.length} built-in skills: ${installed.join(", ")}`);
  } else {
    console.log("Built-in skills already installed.");
  }

  console.log("\nSetup complete! Run 'zubo start' to launch Zubo.\n");
}
