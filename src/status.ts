import { existsSync, readFileSync, readdirSync } from "fs";
import { join } from "path";
import { paths } from "./config/paths";
import { configExists } from "./config/loader";
import { logger } from "./util/logger";

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

interface UsageStat {
  provider: string;
  model: string;
  total_input: number;
  total_output: number;
  calls: number;
}

function getDbStats(): {
  messages: number;
  memories: number;
  usage: UsageStat[];
} | null {
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

    let usage: UsageStat[] = [];
    try {
      usage = db
        .query(
          `SELECT provider, model,
             SUM(input_tokens) as total_input,
             SUM(output_tokens) as total_output,
             COUNT(*) as calls
           FROM usage GROUP BY provider, model`
        )
        .all() as UsageStat[];
    } catch {
      // usage table may not exist yet
    }

    db.close();
    return { messages, memories, usage };
  } catch {
    return null;
  }
}

export function showStatus() {
  console.log("\n  Zubo Status\n");

  // Config
  if (configExists()) {
    console.log("  Config:    ~/.zubo/config.json ✓");
  } else {
    console.log("  Config:    not found (run 'zubo setup')");
  }

  // Database
  const stats = getDbStats();
  if (stats) {
    console.log(`  Database:  ~/.zubo/zubo.db ✓`);
    console.log(`  Messages:  ${stats.messages}`);
    console.log(`  Memories:  ${stats.memories}`);
  } else {
    console.log("  Database:  not found");
  }

  // Usage
  if (stats?.usage?.length) {
    console.log("  Usage:");
    for (const u of stats.usage) {
      const total = u.total_input + u.total_output;
      console.log(
        `    ${u.provider}/${u.model}: ${u.calls} calls, ${total.toLocaleString()} tokens (${u.total_input.toLocaleString()} in / ${u.total_output.toLocaleString()} out)`
      );
    }
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
    } catch (err: any) {
      logger.warn("Failed to read provider config for status", { error: (err as Error).message });
    }
  }

  // Channels
  if (configExists()) {
    try {
      const config = JSON.parse(readFileSync(paths.config, "utf-8"));
      const active: string[] = [];
      if (config.channels?.telegram?.enabled !== false && (config.channels?.telegram?.botToken || config.telegramBotToken)) {
        active.push("telegram");
      }
      if (config.channels?.discord?.enabled !== false && config.channels?.discord?.botToken) {
        active.push("discord");
      }
      if (config.channels?.webchat?.enabled !== false && config.channels?.webchat) {
        const p = config.channels.webchat.port;
        active.push(p ? `webchat(:${p})` : "webchat(auto)");
      }
      console.log(`  Channels:  ${active.length ? active.join(", ") : "none"}`);
    } catch (err: any) {
      logger.warn("Failed to read channel config for status", { error: (err as Error).message });
    }
  }

  // Skills
  if (existsSync(paths.skills)) {
    try {
      const skillEntries = readdirSync(paths.skills).filter((e) =>
        existsSync(join(paths.skills, e, "SKILL.md"))
      );
      console.log(`  Skills:    ${skillEntries.length} installed`);
    } catch {
      console.log("  Skills:    error reading");
    }
  } else {
    console.log("  Skills:    none");
  }

  // SYSTEM.md
  if (existsSync(paths.systemPrompt)) {
    console.log("  Prompt:    ~/.zubo/workspace/SYSTEM.md ✓");
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
