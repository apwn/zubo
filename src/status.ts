import { existsSync, readFileSync } from "fs";
import { paths } from "./config/paths";
import { configExists } from "./config/loader";

function isDaemonRunning(): { running: boolean; pid?: number } {
  if (!existsSync(paths.pidFile)) return { running: false };
  try {
    const pid = parseInt(readFileSync(paths.pidFile, "utf-8").trim(), 10);
    if (isNaN(pid)) return { running: false };
    process.kill(pid, 0); // throws if process doesn't exist
    return { running: true, pid };
  } catch {
    return { running: false };
  }
}

function getDbStats(): { messages: number; memories: number } | null {
  if (!existsSync(paths.db)) return null;
  try {
    const { Database } = require("bun:sqlite");
    const db = new Database(paths.db, { readonly: true });
    const messages =
      (db.query("SELECT COUNT(*) as count FROM messages").get() as any)
        ?.count ?? 0;
    const memories =
      (db.query("SELECT COUNT(*) as count FROM memory_chunks").get() as any)
        ?.count ?? 0;
    db.close();
    return { messages, memories };
  } catch {
    return null;
  }
}

export function showStatus() {
  console.log("\n  Orba Status\n");

  // Config
  if (configExists()) {
    console.log("  Config:    ~/.orba/config.json ✓");
  } else {
    console.log("  Config:    not found (run 'bun run setup')");
  }

  // Database
  const stats = getDbStats();
  if (stats) {
    console.log(`  Database:  ~/.orba/orba.db ✓`);
    console.log(`  Messages:  ${stats.messages}`);
    console.log(`  Memories:  ${stats.memories}`);
  } else {
    console.log("  Database:  not found");
  }

  // LLM Provider
  if (configExists()) {
    try {
      const config = JSON.parse(readFileSync(paths.config, "utf-8"));
      if (config.providers && config.activeProvider) {
        const active = config.providers[config.activeProvider];
        const failover = config.failover?.length
          ? ` → ${config.failover.join(", ")}`
          : "";
        console.log(`  Provider:  ${config.activeProvider}/${active?.model ?? "?"}${failover}`);
      } else if (config.anthropicApiKey) {
        console.log(`  Provider:  anthropic/${config.model ?? "claude-sonnet-4-5-20250929"} (legacy)`);
      }
    } catch {}
  }

  // SYSTEM.md
  if (existsSync(paths.systemPrompt)) {
    console.log("  Prompt:    ~/.orba/workspace/SYSTEM.md ✓");
  } else {
    console.log("  Prompt:    using default (no SYSTEM.md)");
  }

  // Daemon status
  const daemon = isDaemonRunning();
  if (daemon.running) {
    console.log(`  Status:    running (PID ${daemon.pid})`);
  } else {
    console.log("  Status:    not running");
  }

  console.log("");
}
