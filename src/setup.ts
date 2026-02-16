import { paths, ensureDirectories } from "./config/paths";
import { saveConfig } from "./config/loader";
import { configSchema } from "./config/schema";
import type { ProviderConfig, ZuboConfig } from "./config/schema";
import { getDb } from "./db/connection";
import { runMigrations } from "./db/migrations";
import { createProvider, validateProvider } from "./llm/factory";
import { logger } from "./util/logger";
import { existsSync } from "fs";
import { installBuiltinSkills } from "./tools/skill-installer";

// ── Terminal colors ──────────────────────────────────────────────
const BOLD = "\x1b[1m";
const DIM = "\x1b[2m";
const GREEN = "\x1b[32m";
const YELLOW = "\x1b[33m";
const CYAN = "\x1b[36m";
const MAGENTA = "\x1b[35m";
const RESET = "\x1b[0m";

const ok = (msg: string) => console.log(`  ${GREEN}${BOLD}✓${RESET} ${msg}`);
const info = (msg: string) => console.log(`  ${CYAN}→${RESET} ${msg}`);
const warn = (msg: string) => console.log(`  ${YELLOW}!${RESET} ${msg}`);

async function prompt(question: string): Promise<string> {
  process.stdout.write(question);
  for await (const line of console) {
    return line.trim();
  }
  return "";
}

function step(n: number, total: number, title: string) {
  console.log("");
  console.log(`  ${DIM}─────────────────────────────────────────${RESET}`);
  console.log(`  ${MAGENTA}${BOLD}Step ${n}/${total}${RESET}  ${BOLD}${title}${RESET}`);
  console.log(`  ${DIM}─────────────────────────────────────────${RESET}`);
  console.log("");
}

// ── Provider definitions ─────────────────────────────────────────

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
      const apiKey = await prompt("  Anthropic API key (sk-ant-...): ");
      if (apiKey && !apiKey.startsWith("sk-ant-")) {
        warn("Key doesn't start with 'sk-ant-'. Proceeding anyway.");
      }
      const model = await prompt("  Model [claude-sonnet-4-5-20250929]: ");
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
      const apiKey = await prompt("  OpenAI API key (sk-...): ");
      const model = await prompt("  Model [gpt-4.1]: ");
      return {
        name: "openai",
        config: { apiKey, model: model || "gpt-4.1" },
      };
    },
  },
  {
    key: "3",
    label: "Ollama (local)",
    setup: async () => {
      // Check if ollama is installed
      const which = Bun.spawnSync(["which", "ollama"], { stdout: "pipe", stderr: "pipe" });
      if (which.exitCode !== 0) {
        warn("'ollama' not found on your system.\n");
        console.log(`    Install Ollama from ${CYAN}https://ollama.com${RESET}`);
        console.log(`    ${DIM}macOS:   brew install ollama${RESET}`);
        console.log(`    ${DIM}Linux:   curl -fsSL https://ollama.com/install.sh | sh${RESET}`);
        console.log(`    ${DIM}Windows: Download from https://ollama.com/download${RESET}\n`);
        const cont = await prompt("  Press Enter after installing, or 'skip' to configure anyway: ");
        if (cont.toLowerCase() !== "skip") {
          const recheck = Bun.spawnSync(["which", "ollama"], { stdout: "pipe", stderr: "pipe" });
          if (recheck.exitCode !== 0) {
            warn("Still not found. Saving config anyway — install Ollama before starting.\n");
          }
        }
      } else {
        ok("'ollama' CLI found");
      }

      // Check if Ollama server is running
      const baseUrl = "http://localhost:11434/v1";
      info("Checking if Ollama server is running...");
      let models: string[] = [];
      try {
        const res = await fetch("http://localhost:11434/api/tags", { signal: AbortSignal.timeout(3000) });
        if (res.ok) {
          const data = await res.json() as { models?: { name: string }[] };
          models = (data.models ?? []).map(m => m.name);
          ok(`Ollama is running (${models.length} model${models.length !== 1 ? "s" : ""} available)`);
        } else {
          warn("Ollama server responded with an error. Make sure it's running: ollama serve");
        }
      } catch {
        warn("Ollama server not reachable at localhost:11434.");
        info("Start it with: ollama serve");
        info("Or on macOS, just open the Ollama app.\n");
      }

      // Show available models or suggest pulling one
      let model = "";
      if (models.length > 0) {
        console.log(`\n    ${BOLD}Available models:${RESET}`);
        models.slice(0, 10).forEach((m, i) => console.log(`    ${DIM}${(i + 1).toString().padStart(2)}.${RESET} ${m}`));
        if (models.length > 10) console.log(`    ${DIM}   ... and ${models.length - 10} more${RESET}`);
        console.log("");
        const modelInput = await prompt(`  Model [${models[0]}]: `);
        const num = parseInt(modelInput, 10);
        if (modelInput && !isNaN(num) && num >= 1 && num <= models.length) {
          model = models[num - 1];
        } else {
          model = modelInput || models[0];
        }
      } else {
        info("No models downloaded yet. Pull one with:");
        console.log(`    ${DIM}ollama pull llama3.3${RESET}`);
        console.log(`    ${DIM}ollama pull mistral${RESET}`);
        console.log(`    ${DIM}ollama pull qwen2.5${RESET}\n`);
        model = await prompt("  Model [llama3.3]: ");
        model = model || "llama3.3";
      }

      return {
        name: "ollama",
        config: {
          baseUrl,
          apiKey: "ollama",
          model,
        },
      };
    },
  },
  {
    key: "4",
    label: "Groq",
    setup: async () => {
      const apiKey = await prompt("  Groq API key (gsk_...): ");
      const model = await prompt("  Model [llama-3.3-70b-versatile]: ");
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
      const apiKey = await prompt("  Together API key: ");
      const model = await prompt("  Model [meta-llama/Llama-3.3-70B-Instruct-Turbo]: ");
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
      const apiKey = await prompt("  OpenRouter API key: ");
      const model = await prompt("  Model [anthropic/claude-sonnet-4-5]: ");
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
    label: "DeepSeek",
    setup: async () => {
      const apiKey = await prompt("  DeepSeek API key: ");
      const model = await prompt("  Model [deepseek-chat]: ");
      return {
        name: "deepseek",
        config: {
          apiKey,
          baseUrl: "https://api.deepseek.com/v1",
          model: model || "deepseek-chat",
        },
      };
    },
  },
  {
    key: "8",
    label: "xAI (Grok)",
    setup: async () => {
      const apiKey = await prompt("  xAI API key: ");
      const model = await prompt("  Model [grok-4.1-fast]: ");
      return {
        name: "xai",
        config: {
          apiKey,
          baseUrl: "https://api.x.ai/v1",
          model: model || "grok-4.1-fast",
        },
      };
    },
  },
  {
    key: "9",
    label: "MiniMax (M2.5)",
    setup: async () => {
      const apiKey = await prompt("  MiniMax API key: ");
      const model = await prompt("  Model [MiniMax-M2.5] (or MiniMax-M2.5-highspeed): ");
      return {
        name: "minimax",
        config: {
          apiKey,
          model: model || "MiniMax-M2.5",
        },
      };
    },
  },
  {
    key: "10",
    label: "Fireworks AI",
    setup: async () => {
      const apiKey = await prompt("  Fireworks API key: ");
      const model = await prompt("  Model [accounts/fireworks/models/llama-v3p3-70b-instruct]: ");
      return {
        name: "fireworks",
        config: {
          apiKey,
          baseUrl: "https://api.fireworks.ai/inference/v1",
          model: model || "accounts/fireworks/models/llama-v3p3-70b-instruct",
        },
      };
    },
  },
  {
    key: "11",
    label: "Cerebras",
    setup: async () => {
      const apiKey = await prompt("  Cerebras API key: ");
      const model = await prompt("  Model [llama-3.3-70b]: ");
      return {
        name: "cerebras",
        config: {
          apiKey,
          baseUrl: "https://api.cerebras.ai/v1",
          model: model || "llama-3.3-70b",
        },
      };
    },
  },
  {
    key: "12",
    label: "LM Studio (local)",
    setup: async () => {
      const baseUrl = "http://localhost:1234/v1";
      info("Checking if LM Studio server is running...");

      let models: string[] = [];
      try {
        const res = await fetch(`${baseUrl}/models`, { signal: AbortSignal.timeout(3000) });
        if (res.ok) {
          const data = await res.json() as { data?: { id: string }[] };
          models = (data.data ?? []).map(m => m.id);
          ok(`LM Studio is running (${models.length} model${models.length !== 1 ? "s" : ""} loaded)`);
        }
      } catch {
        warn("LM Studio server not reachable at localhost:1234.\n");
        console.log(`    ${BOLD}To set up LM Studio:${RESET}`);
        console.log(`    ${DIM}1.${RESET} Download from ${CYAN}https://lmstudio.ai${RESET}`);
        console.log(`    ${DIM}2.${RESET} Open LM Studio and download a model (e.g. Llama 3.3, Mistral)`);
        console.log(`    ${DIM}3.${RESET} Go to the "Local Server" tab (left sidebar)`);
        console.log(`    ${DIM}4.${RESET} Click "Start Server" — it runs on port 1234 by default\n`);
        const cont = await prompt("  Press Enter once LM Studio server is running, or 'skip' to configure anyway: ");
        if (cont.toLowerCase() !== "skip") {
          try {
            const retry = await fetch(`${baseUrl}/models`, { signal: AbortSignal.timeout(3000) });
            if (retry.ok) {
              const data = await retry.json() as { data?: { id: string }[] };
              models = (data.data ?? []).map(m => m.id);
              ok(`LM Studio is running (${models.length} model${models.length !== 1 ? "s" : ""} loaded)`);
            } else {
              warn("Still not reachable. Config saved — start LM Studio before running Zubo.");
            }
          } catch {
            warn("Still not reachable. Config saved — start LM Studio before running Zubo.");
          }
        }
      }

      let model = "";
      if (models.length > 0) {
        console.log(`\n    ${BOLD}Loaded models:${RESET}`);
        models.forEach((m, i) => console.log(`    ${DIM}${(i + 1).toString().padStart(2)}.${RESET} ${m}`));
        console.log("");
        const lmsInput = await prompt(`  Model [${models[0]}]: `);
        const lmsNum = parseInt(lmsInput, 10);
        if (lmsInput && !isNaN(lmsNum) && lmsNum >= 1 && lmsNum <= models.length) {
          model = models[lmsNum - 1];
        } else {
          model = lmsInput || models[0];
        }
      } else {
        info("No models detected. Load a model in LM Studio first.");
        model = await prompt("  Model name: ");
        model = model || "default";
      }

      return {
        name: "lmstudio",
        config: {
          baseUrl,
          apiKey: "lm-studio",
          model,
        },
      };
    },
  },
  {
    key: "13",
    label: "Claude Code (CLI)",
    setup: async () => {
      // Check if claude CLI is installed
      const which = Bun.spawnSync(["which", "claude"], { stdout: "pipe", stderr: "pipe" });
      if (which.exitCode !== 0) {
        warn("'claude' CLI not found. Install it first:");
        console.log(`    ${DIM}npm install -g @anthropic-ai/claude-code${RESET}\n`);
        const cont = await prompt("  Press Enter after installing, or 'skip' to continue anyway: ");
        if (cont.toLowerCase() === "skip") {
          return { name: "claude-code", config: { model: "claude-sonnet-4-5-20250929" } };
        }
        const recheck = Bun.spawnSync(["which", "claude"], { stdout: "pipe", stderr: "pipe" });
        if (recheck.exitCode !== 0) {
          warn("Still not found. Config saved — install 'claude' CLI before starting.");
          return { name: "claude-code", config: { model: "claude-sonnet-4-5-20250929" } };
        }
      }
      ok("'claude' CLI found");
      // Quick auth check — run claude with a trivial prompt and short timeout
      const check = Bun.spawnSync(["claude", "-p", "hi", "--max-turns", "1"], {
        stdout: "pipe", stderr: "pipe", timeout: 10_000,
      });
      if (check.exitCode === 0) {
        ok("Claude Code authenticated");
      } else {
        warn("Claude Code may not be authenticated yet.");
        info("Open a separate terminal and run: claude");
        info("Complete the login flow, then come back here.\n");
        await prompt("  Press Enter once you've authenticated... ");
        // Re-check
        const recheck = Bun.spawnSync(["claude", "-p", "hi", "--max-turns", "1"], {
          stdout: "pipe", stderr: "pipe", timeout: 10_000,
        });
        if (recheck.exitCode === 0) {
          ok("Claude Code authenticated");
        } else {
          warn("Still not authenticated. Run 'claude' in a terminal to log in before starting Zubo.");
        }
      }
      return { name: "claude-code", config: { model: "claude-sonnet-4-5-20250929" } };
    },
  },
  {
    key: "14",
    label: "OpenAI Codex (CLI)",
    setup: async () => {
      // Check if codex CLI is installed
      const which = Bun.spawnSync(["which", "codex"], { stdout: "pipe", stderr: "pipe" });
      if (which.exitCode !== 0) {
        warn("'codex' CLI not found. Install it first:");
        console.log(`    ${DIM}npm install -g @openai/codex${RESET}\n`);
        const cont = await prompt("  Press Enter after installing, or 'skip' to continue anyway: ");
        if (cont.toLowerCase() === "skip") {
          return { name: "codex", config: { model: "o4-mini" } };
        }
        const recheck = Bun.spawnSync(["which", "codex"], { stdout: "pipe", stderr: "pipe" });
        if (recheck.exitCode !== 0) {
          warn("Still not found. Config saved — install 'codex' CLI before starting.");
          return { name: "codex", config: { model: "o4-mini" } };
        }
      }
      ok("'codex' CLI found");
      info("Authenticating — this will open your browser if needed...");
      const login = Bun.spawnSync(["codex", "login"], {
        stdin: "inherit", stdout: "inherit", stderr: "inherit",
      });
      if (login.exitCode !== 0) {
        warn("Login may not have completed. Run 'codex login' manually later.");
      } else {
        ok("Codex ready");
      }
      return { name: "codex", config: { model: "o4-mini" } };
    },
  },
  {
    key: "15",
    label: "Other (OpenAI-compatible)",
    setup: async () => {
      const name = await prompt("  Provider name: ");
      const baseUrl = await prompt("  Base URL (e.g. https://api.example.com/v1): ");
      const apiKey = await prompt("  API key (or 'none'): ");
      const model = await prompt("  Model name: ");
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
    console.log(`    ${DIM}${opt.key.padStart(2)}.${RESET} ${opt.label}`);
  }
  console.log("");
}

async function pickProvider(): Promise<{ name: string; config: ProviderConfig } | null> {
  const maxKey = PROVIDER_OPTIONS.length;
  const choice = await prompt(`  Provider [1-${maxKey}]: `);
  const option = PROVIDER_OPTIONS.find((o) => o.key === choice);
  if (!option) return null;
  console.log("");
  return option.setup();
}

// ── Step 1: LLM Provider ────────────────────────────────────────

async function setupProvider(): Promise<{
  providers: Record<string, ProviderConfig>;
  activeProvider: string;
  failover: string[];
  anthropicApiKey?: string;
}> {
  console.log("  Choose your LLM provider:\n");
  printProviderMenu();

  const result = await pickProvider();
  if (!result) {
    warn("Invalid choice. Defaulting to Anthropic.\n");
    const apiKey = await prompt("  Anthropic API key (sk-ant-...): ");
    const model = "claude-sonnet-4-5-20250929";
    return {
      providers: { anthropic: { apiKey, model } },
      activeProvider: "anthropic",
      failover: [],
      anthropicApiKey: apiKey,
    };
  }

  const providers: Record<string, ProviderConfig> = {
    [result.name]: result.config,
  };
  const anthropicApiKey =
    result.name === "anthropic" ? result.config.apiKey : undefined;

  const isCliProvider = result.name === "claude-code" || result.name === "codex";
  ok(`${result.name} configured` + (isCliProvider ? "" : ` (${result.config.model})`));

  // Quick validation — test if the provider actually works
  if (!isCliProvider) {
    info("Testing connection...");
    try {
      const testConfig = configSchema.parse({
        providers: { [result.name]: result.config },
        activeProvider: result.name,
      }) as ZuboConfig;
      const testLlm = await createProvider(testConfig);
      const validationErr = await validateProvider(testLlm);
      if (validationErr) {
        warn(validationErr);
        info("You can fix this later with: zubo config set providers." + result.name + ".apiKey <key>");
      } else {
        ok("Connection verified — API key works!");
      }
    } catch {
      // Validation itself failed — not critical, move on
    }
  }

  // Offer fallback
  const addFallback = await prompt("\n  Add a fallback provider? (y/N): ");
  const failover: string[] = [];
  if (addFallback.toLowerCase() === "y") {
    console.log("\n  Fallback provider:\n");
    printProviderMenu();
    const fb = await pickProvider();
    if (fb) {
      providers[fb.name] = fb.config;
      failover.push(fb.name);
      const isFbCli = fb.name === "claude-code" || fb.name === "codex";
      ok(`${fb.name} added as fallback` + (isFbCli ? "" : ` (${fb.config.model})`));
    }
  }

  return { providers, activeProvider: result.name, failover, anthropicApiKey };
}

// ── Step 2: Channels ────────────────────────────────────────────

async function setupChannels(): Promise<{
  channels: Record<string, any>;
  telegramBotToken?: string;
}> {
  console.log("  Which channels do you want to enable?\n");
  console.log(`    ${DIM} 1.${RESET} Telegram`);
  console.log(`    ${DIM} 2.${RESET} Discord`);
  console.log(`    ${DIM} 3.${RESET} Slack`);
  console.log(`    ${DIM} 4.${RESET} WhatsApp`);
  console.log(`    ${DIM} 5.${RESET} Signal`);
  console.log(`    ${DIM} 6.${RESET} Email (IMAP/SMTP)`);
  console.log("");
  console.log(`  ${DIM}WebChat (dashboard) is always enabled.${RESET}`);
  console.log(`  ${DIM}Enter numbers separated by commas, or press Enter to skip.${RESET}\n`);

  const choices = await prompt("  Channels: ");
  const selected = choices
    ? choices.split(",").map((s) => s.trim())
    : [];

  const channels: Record<string, any> = {
    webchat: { enabled: true, port: 0 },
  };
  let telegramBotToken: string | undefined;

  if (selected.includes("1")) {
    console.log("");
    console.log(`  ${DIM}To create a Telegram bot:${RESET}`);
    console.log(`  ${DIM}  1. Open Telegram → message @BotFather${RESET}`);
    console.log(`  ${DIM}  2. Send /newbot and follow the prompts${RESET}`);
    console.log(`  ${DIM}  3. Copy the bot token${RESET}\n`);
    const token = await prompt("  Telegram bot token: ");
    channels.telegram = { enabled: true, botToken: token, allowedUsers: [] };
    telegramBotToken = token;
    ok("Telegram configured");
  }

  if (selected.includes("2")) {
    console.log("");
    console.log(`  ${DIM}To create a Discord bot:${RESET}`);
    console.log(`  ${DIM}  1. Go to discord.com/developers/applications${RESET}`);
    console.log(`  ${DIM}  2. Create app → Bot → copy token${RESET}`);
    console.log(`  ${DIM}  3. Enable MESSAGE CONTENT intent${RESET}`);
    console.log(`  ${DIM}  4. Invite with messages scope${RESET}\n`);
    const token = await prompt("  Discord bot token: ");
    channels.discord = { enabled: true, botToken: token, allowedUsers: [] };
    ok("Discord configured");
  }

  if (selected.includes("3")) {
    console.log("");
    console.log(`  ${DIM}To create a Slack bot:${RESET}`);
    console.log(`  ${DIM}  1. Go to api.slack.com/apps → Create New App${RESET}`);
    console.log(`  ${DIM}  2. Enable Socket Mode → copy App Token (xapp-...)${RESET}`);
    console.log(`  ${DIM}  3. Under OAuth, copy Bot Token (xoxb-...)${RESET}\n`);
    const botToken = await prompt("  Slack bot token (xoxb-...): ");
    const appToken = await prompt("  Slack app token (xapp-...): ");
    channels.slack = {
      enabled: true,
      botToken,
      appToken,
      allowedUsers: [],
    };
    ok("Slack configured");
  }

  if (selected.includes("4")) {
    console.log("");
    console.log(`  ${DIM}WhatsApp uses whatsapp-web.js. A QR code will appear on first start.${RESET}\n`);
    channels.whatsapp = { enabled: true, allowedNumbers: [] };
    ok("WhatsApp configured (scan QR on first start)");
  }

  if (selected.includes("5")) {
    console.log("");
    console.log(`  ${DIM}Signal requires signal-cli installed and registered.${RESET}\n`);
    const phone = await prompt("  Signal phone number (+1234567890): ");
    channels.signal = {
      enabled: true,
      phoneNumber: phone,
      allowedNumbers: [],
    };
    ok("Signal configured");
  }

  if (selected.includes("6")) {
    console.log("");
    console.log(`  ${DIM}Email requires IMAP (receive) and SMTP (send) credentials.${RESET}`);
    console.log(`  ${DIM}For Gmail, use an App Password: myaccount.google.com/apppasswords${RESET}\n`);
    const imapHost = await prompt("  IMAP host (e.g. imap.gmail.com): ");
    const imapUser = await prompt("  IMAP username (email address): ");
    const imapPass = await prompt("  IMAP password: ");
    const smtpHost = await prompt("  SMTP host (e.g. smtp.gmail.com): ");
    const smtpUser = await prompt(`  SMTP username [${imapUser}]: `);
    const smtpPass = await prompt(`  SMTP password [same as IMAP]: `);
    channels.email = {
      enabled: true,
      imap: { host: imapHost, user: imapUser, password: imapPass, port: 993, tls: true },
      smtp: { host: smtpHost, user: smtpUser || imapUser, password: smtpPass || imapPass, port: 587, tls: true },
      allowedSenders: [],
    };
    ok("Email configured");
  }

  if (selected.length === 0) {
    info("No extra channels selected. WebChat dashboard is ready.");
  }

  return { channels, telegramBotToken };
}

// ── Step 3: Personalization ─────────────────────────────────────

async function setupPersonality(): Promise<{ agentName: string; personality: string }> {
  const name = await prompt("  Agent name [Zubo]: ");
  const agentName = name || "Zubo";

  console.log("");
  console.log(`  ${DIM}Describe your agent's personality in a sentence or two.${RESET}`);
  console.log(`  ${DIM}Press Enter for a sensible default.${RESET}\n`);
  const personality = await prompt("  Personality: ");

  ok(`Agent name: ${agentName}`);

  return { agentName, personality };
}

// ── Step 4: Smart Routing ───────────────────────────────────────

async function setupSmartRouting(
  providers: Record<string, ProviderConfig>,
  activeProvider: string
): Promise<{ enabled: boolean; fastProvider?: string; fastModel?: string }> {
  console.log(`  ${DIM}Smart routing sends simple queries (greetings, one-liners) to a${RESET}`);
  console.log(`  ${DIM}fast, cheap model and uses your main provider for complex tasks.${RESET}`);
  console.log(`  ${DIM}This can save 50-80% on API costs.${RESET}\n`);

  const enable = await prompt("  Enable smart routing? (Y/n): ");
  if (enable.toLowerCase() === "n") {
    return { enabled: false };
  }

  // If they have a second provider, suggest it; otherwise suggest Groq
  const otherProviders = Object.keys(providers).filter((k) => k !== activeProvider);

  if (otherProviders.length > 0) {
    const suggested = otherProviders[0];
    ok(`Smart routing enabled (fast provider: ${suggested})`);
    return { enabled: true, fastProvider: suggested };
  }

  console.log("");
  console.log(`  ${DIM}Which provider should handle simple queries?${RESET}`);
  console.log(`  ${DIM}Groq is free and very fast. Or press Enter to use your main provider.${RESET}\n`);

  console.log(`    ${DIM} 1.${RESET} Groq (free tier, very fast)`);
  console.log(`    ${DIM} 2.${RESET} Use a smaller model on ${activeProvider}`);
  console.log(`    ${DIM} 3.${RESET} Skip for now\n`);

  const choice = await prompt("  Choice [1]: ");

  if (choice === "3") {
    return { enabled: false };
  }

  if (choice === "2") {
    const fastModel = await prompt("  Fast model name: ");
    if (fastModel) {
      ok(`Smart routing enabled (fast model: ${fastModel})`);
      return { enabled: true, fastProvider: activeProvider, fastModel };
    }
    return { enabled: false };
  }

  // Default: Groq
  const groqKey = await prompt("  Groq API key (gsk_..., or Enter to skip): ");
  if (!groqKey) {
    info("Skipping smart routing for now. You can enable it later in the dashboard.");
    return { enabled: false };
  }

  providers["groq"] = {
    apiKey: groqKey,
    model: "llama-3.3-70b-versatile",
  };
  ok("Smart routing enabled (fast provider: groq)");
  return { enabled: true, fastProvider: "groq" };
}

// ── Main Setup ──────────────────────────────────────────────────

export async function runSetup() {
  // Welcome
  console.log("");
  console.log(`  ${BOLD}${MAGENTA}◆${RESET} ${BOLD}zubo setup${RESET}`);
  console.log(`  ${DIM}The AI agent that never forgets.${RESET}`);
  console.log("");
  console.log(`  ${DIM}This wizard will configure your agent in 4 steps.${RESET}`);
  console.log(`  ${DIM}Press Enter at any prompt to accept the default [in brackets].${RESET}`);
  console.log("");

  // ── Setup mode choice ──
  console.log(`  ${BOLD}Setup mode:${RESET}`);
  console.log(`    ${DIM}1.${RESET} Terminal`);
  console.log(`    ${DIM}2.${RESET} Dashboard ${DIM}(opens in your browser)${RESET}`);
  console.log("");
  const mode = await prompt("  Choice [1]: ");
  if (mode === "2" || mode.toLowerCase() === "d" || mode.toLowerCase() === "dashboard") {
    const { runWebSetup } = await import("./setup-web");
    return runWebSetup();
  }

  // ── Step 1: LLM Provider ──
  step(1, 4, "LLM Provider");
  const { providers, activeProvider, failover, anthropicApiKey } = await setupProvider();

  // ── Step 2: Channels ──
  step(2, 4, "Channels");
  const { channels, telegramBotToken } = await setupChannels();

  // ── Step 3: Personalization ──
  step(3, 4, "Personalization");
  const { agentName, personality } = await setupPersonality();

  // ── Step 4: Smart Routing ──
  step(4, 4, "Smart Routing");
  const smartRouting = await setupSmartRouting(providers, activeProvider);

  // ── Finalize ──────────────────────────────────────────────────
  await finalizeSetup({
    providers,
    activeProvider,
    failover,
    anthropicApiKey,
    telegramBotToken,
    channels,
    smartRouting,
    agentName,
    personality,
  });
}

// ── Shared finalization (used by both terminal & web setup) ──

export interface SetupResult {
  providers: Record<string, ProviderConfig>;
  activeProvider: string;
  failover: string[];
  anthropicApiKey?: string;
  telegramBotToken?: string;
  channels: Record<string, any>;
  smartRouting: { enabled: boolean; fastProvider?: string; fastModel?: string };
  agentName: string;
  personality: string;
}

export async function finalizeSetup(result: SetupResult) {
  const {
    providers, activeProvider, failover, anthropicApiKey, telegramBotToken,
    channels, smartRouting, agentName, personality,
  } = result;

  console.log("");
  console.log(`  ${DIM}─────────────────────────────────────────${RESET}`);
  console.log(`  ${BOLD}Setting up...${RESET}`);
  console.log(`  ${DIM}─────────────────────────────────────────${RESET}`);
  console.log("");

  // Create directory tree
  ensureDirectories();
  ok("Created ~/.zubo/ directory tree");

  // Write config
  const config = configSchema.parse({
    // Legacy compat
    anthropicApiKey,
    model: providers[activeProvider].model,
    telegramBotToken,
    telegramAllowedUsers: [],

    // Provider system
    providers,
    activeProvider,
    failover: failover.length ? failover : undefined,

    // Channels
    channels,

    // Smart routing
    smartRouting: smartRouting.enabled
      ? {
          enabled: true,
          fastProvider: smartRouting.fastProvider,
          fastModel: smartRouting.fastModel,
        }
      : undefined,

    // Agent name
    agentName,
  });
  await saveConfig(config);
  ok(`Config saved to ${paths.config}`);

  // Init database
  const db = getDb();
  runMigrations(db);
  db.close();
  ok(`Database initialized at ${paths.db}`);

  // Create initial MEMORY.md
  if (!existsSync(paths.memoryFile)) {
    await Bun.write(
      paths.memoryFile,
      `# ${agentName} Memory\n\nThis file stores persistent memories about the user.\n`
    );
  }
  ok("Memory file ready");

  // Create SYSTEM.md only if the user customized the name or personality.
  if (!existsSync(paths.systemPrompt)) {
    if (agentName !== "Zubo" || personality) {
      const nameLine = agentName !== "Zubo"
        ? `You are ${agentName}, a personal AI agent.`
        : "You are Zubo, a personal AI agent.";
      const personalityLine = personality
        ? ` ${personality}`
        : " You are friendly, straight to the point, and solution-driven.";

      await Bun.write(
        paths.systemPrompt,
        `${nameLine}${personalityLine}\n`
      );
    }
  }
  ok("System prompt ready");

  // Install built-in skills
  const installed = installBuiltinSkills(paths.skills);
  if (installed.length) {
    ok(`Installed ${installed.length} built-in skills`);
  } else {
    ok("Built-in skills already installed");
  }

  // ── Summary ───────────────────────────────────────────────────
  console.log("");
  console.log(`  ${DIM}═════════════════════════════════════════${RESET}`);
  console.log(`  ${GREEN}${BOLD}Setup complete!${RESET}`);
  console.log(`  ${DIM}═════════════════════════════════════════${RESET}`);
  console.log("");
  console.log(`  ${BOLD}Agent:${RESET}    ${agentName}`);
  console.log(`  ${BOLD}Provider:${RESET} ${activeProvider} (${providers[activeProvider].model})`);
  if (failover.length) {
    console.log(`  ${BOLD}Fallback:${RESET} ${failover.join(", ")}`);
  }
  if (smartRouting.enabled) {
    console.log(`  ${BOLD}Routing:${RESET}  Smart (fast → ${smartRouting.fastProvider})`);
  }
  const channelNames = Object.keys(channels).filter(
    (c) => channels[c]?.enabled !== false
  );
  console.log(`  ${BOLD}Channels:${RESET} ${channelNames.join(", ")}`);
  console.log(`  ${BOLD}Config:${RESET}   ${paths.config}`);

  console.log("");
  console.log(`  ${BOLD}Next steps:${RESET}`);
  console.log("");
  console.log(`    ${CYAN}1.${RESET} Start your agent:     ${BOLD}zubo start${RESET}`);
  console.log(`    ${CYAN}2.${RESET} Open the dashboard:   ${DIM}(opens automatically in your browser)${RESET}`);
  console.log(`    ${CYAN}3.${RESET} Connect integrations: ${DIM}tell ${agentName} "connect my GitHub"${RESET}`);
  console.log("");
  console.log(`  ${DIM}Docs: https://zubo.bot/docs${RESET}`);
  console.log(`  ${DIM}Config: zubo config set <key> <value>${RESET}`);
  console.log("");
}
