import { paths, ensureDirectories } from "./config/paths";
import { saveConfig } from "./config/loader";
import { configSchema } from "./config/schema";
import { getDb } from "./db/connection";
import { runMigrations } from "./db/migrations";
import { logger } from "./util/logger";
import { existsSync } from "fs";

async function prompt(question: string): Promise<string> {
  process.stdout.write(question);
  for await (const line of console) {
    return line.trim();
  }
  return "";
}

export async function runSetup() {
  console.log("\n  Orba Setup Wizard\n");
  console.log("This will configure your Orba agent.\n");

  // 1. Anthropic API key
  const anthropicApiKey = await prompt(
    "Anthropic API key (sk-ant-...): "
  );
  if (!anthropicApiKey.startsWith("sk-ant-")) {
    console.log(
      "Warning: Key doesn't start with 'sk-ant-'. Proceeding anyway.\n"
    );
  }

  // 2. Telegram bot token
  console.log("\nTo create a Telegram bot:");
  console.log("  1. Open Telegram and message @BotFather");
  console.log("  2. Send /newbot and follow the prompts");
  console.log("  3. Copy the bot token\n");

  const telegramBotToken = await prompt("Telegram bot token: ");

  // 3. Create directory tree
  console.log("\nCreating ~/.orba/ directory tree...");
  ensureDirectories();

  // 4. Write config
  const config = configSchema.parse({
    anthropicApiKey,
    telegramBotToken,
    telegramAllowedUsers: [],
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
      `# Orba Memory\n\nThis file stores persistent memories about the user.\n`
    );
    console.log(`Created ${paths.memoryFile}`);
  }

  console.log("\nSetup complete! Run 'bun run start' to launch Orba.\n");
}
