#!/usr/bin/env bun
export {};

const command = process.argv[2];

switch (command) {
  case "setup": {
    const { runSetup } = await import("./setup");
    await runSetup();
    break;
  }
  case "start": {
    const isDaemon = process.argv.includes("--daemon");
    const { startZubo } = await import("./start");
    await startZubo(isDaemon);
    break;
  }
  case "stop": {
    const { stopDaemon } = await import("./start");
    stopDaemon();
    break;
  }
  case "status": {
    const { showStatus } = await import("./status");
    showStatus();
    break;
  }
  case "logs": {
    const follow = process.argv.includes("--follow") || process.argv.includes("-f");
    const { showLogs } = await import("./logs");
    await showLogs(follow);
    break;
  }
  case "model": {
    const { runModelCommand } = await import("./model");
    runModelCommand(process.argv.slice(3));
    break;
  }
  case "skills": {
    const { runSkillsCommand } = await import("./skills");
    await runSkillsCommand(process.argv.slice(3));
    break;
  }
  case "install": {
    const skillName = process.argv[3];
    if (!skillName) {
      console.log("Usage: zubo install <skill-name>");
      process.exit(1);
    }
    const { handleRegistryInstall } = await import("./registry/cli");
    await handleRegistryInstall(skillName);
    break;
  }
  case "search": {
    const query = process.argv.slice(3).join(" ");
    if (!query) {
      console.log("Usage: zubo search <query>");
      process.exit(1);
    }
    const { handleRegistrySearch } = await import("./registry/cli");
    await handleRegistrySearch(query);
    break;
  }
  case "publish": {
    const pubName = process.argv[3] ?? "";
    const { handleRegistryPublish } = await import("./registry/cli");
    await handleRegistryPublish(pubName);
    break;
  }
  case "auth": {
    const authAction = process.argv[3];
    const { getDb } = await import("./db/connection");
    const { runMigrations } = await import("./db/migrations");
    const { initAuth, createApiKey, listApiKeys } = await import("./util/auth");
    const authDb = getDb();
    runMigrations(authDb);
    initAuth(authDb);

    if (authAction === "create-key") {
      const label = process.argv[4] ?? "default";
      const result = createApiKey(authDb, label);
      console.log(`API key created (id: ${result.id}, label: ${label}):`);
      console.log(`  ${result.key}`);
      console.log("\nStore this key securely — it cannot be retrieved again.");
    } else if (authAction === "list-keys") {
      const keys = listApiKeys(authDb);
      if (keys.length === 0) {
        console.log("No API keys found. Create one with: zubo auth create-key [label]");
      } else {
        console.log("API Keys:");
        for (const k of keys) {
          console.log(`  #${k.id}  ${k.label || "(no label)"}  created: ${k.created_at}  last used: ${k.last_used_at ?? "never"}`);
        }
      }
    } else if (authAction === "delete-key") {
      const { deleteApiKey } = await import("./util/auth");
      const keyId = parseInt(process.argv[4] ?? "", 10);
      if (isNaN(keyId)) {
        console.log("Usage: zubo auth delete-key <id>");
        process.exit(1);
      }
      const deleted = deleteApiKey(authDb, keyId);
      console.log(deleted ? `API key #${keyId} deleted.` : `API key #${keyId} not found.`);
    } else {
      console.log("Usage: zubo auth <command>\n");
      console.log("Commands:");
      console.log("  create-key [label]   Create a new API key");
      console.log("  list-keys            List all API keys");
      console.log("  delete-key <id>      Delete an API key");
    }
    break;
  }
  case "config": {
    const configAction = process.argv[3];
    if (configAction === "set") {
      const key = process.argv[4];
      const value = process.argv[5];
      if (!key || value === undefined) {
        console.log("Usage: zubo config set <key> <value>");
        console.log("\nExamples:");
        console.log("  zubo config set heartbeatMinutes 60");
        console.log("  zubo config set maxTurns 100");
        console.log("  zubo config set activeProvider ollama");
        console.log("  zubo config set model llama3.3");
        console.log("  zubo config set auth.enabled true");
        console.log("  zubo config set rateLimit.chatPerMinute 30");
        process.exit(1);
      }
      const { readFileSync, writeFileSync } = await import("fs");
      const { paths: cfgPaths } = await import("./config/paths");
      try {
        const config = JSON.parse(readFileSync(cfgPaths.config, "utf-8"));
        // Support dotted keys (e.g. auth.enabled, rateLimit.chatPerMinute)
        const keys = key.split(".");
        let target = config;
        for (let i = 0; i < keys.length - 1; i++) {
          if (!target[keys[i]] || typeof target[keys[i]] !== "object") {
            target[keys[i]] = {};
          }
          target = target[keys[i]];
        }
        const finalKey = keys[keys.length - 1];
        // Parse value types
        let parsed: any = value;
        if (value === "true") parsed = true;
        else if (value === "false") parsed = false;
        else if (/^\d+$/.test(value)) parsed = parseInt(value, 10);
        else if (/^\d+\.\d+$/.test(value)) parsed = parseFloat(value);

        target[finalKey] = parsed;
        writeFileSync(cfgPaths.config, JSON.stringify(config, null, 2) + "\n");
        console.log(`Set ${key} = ${JSON.stringify(parsed)}`);
      } catch (err: any) {
        console.error(`Error: ${err.message}`);
        process.exit(1);
      }
    } else if (configAction === "get") {
      const key = process.argv[4];
      const { readFileSync } = await import("fs");
      const { paths: cfgPaths } = await import("./config/paths");
      try {
        const config = JSON.parse(readFileSync(cfgPaths.config, "utf-8"));
        if (!key) {
          // Print full config (mask sensitive values)
          const masked = { ...config };
          if (masked.anthropicApiKey) masked.anthropicApiKey = "***";
          if (masked.providers) {
            for (const p of Object.values(masked.providers) as any[]) {
              if (p.apiKey) p.apiKey = "***";
            }
          }
          console.log(JSON.stringify(masked, null, 2));
        } else {
          const keys = key.split(".");
          let val: any = config;
          for (const k of keys) val = val?.[k];
          console.log(val !== undefined ? JSON.stringify(val) : "(not set)");
        }
      } catch (err: any) {
        console.error(`Error: ${err.message}`);
        process.exit(1);
      }
    } else {
      console.log("Usage: zubo config <command>\n");
      console.log("Commands:");
      console.log("  set <key> <value>   Set a config value");
      console.log("  get [key]           Get a config value (or all if no key)");
    }
    break;
  }
  case "export": {
    const { getDb } = await import("./db/connection");
    const { runMigrations } = await import("./db/migrations");
    const { exportDatabase, backupDatabase, getDbStats, getDbSizeBytes } = await import("./db/export");
    const { paths: exportPaths } = await import("./config/paths");
    const exportDb = getDb();
    runMigrations(exportDb);

    const format = process.argv.includes("--format") ? process.argv[process.argv.indexOf("--format") + 1] : "json";
    const outputIdx = process.argv.indexOf("--output");
    const output = outputIdx !== -1 ? process.argv[outputIdx + 1] : undefined;

    if (format === "sqlite") {
      const backupDir = output ?? process.cwd();
      const backupPath = backupDatabase(exportPaths.db, backupDir);
      console.log(`SQLite backup created: ${backupPath}`);
    } else {
      const outputPath = output ?? `zubo-export-${new Date().toISOString().replace(/[:.]/g, "-")}.json`;
      exportDatabase(exportDb, outputPath);
      const stats = getDbStats(exportDb);
      const totalRows = Object.values(stats.tables).reduce((a, b) => a + b, 0);
      console.log(`Exported ${totalRows} rows to ${outputPath}`);
    }
    break;
  }
  case "import": {
    const importPath = process.argv[3];
    if (!importPath) {
      console.log("Usage: zubo import <path>");
      process.exit(1);
    }
    const { getDb } = await import("./db/connection");
    const { runMigrations } = await import("./db/migrations");
    const { importDatabase } = await import("./db/export");
    const importDb = getDb();
    runMigrations(importDb);
    const result = importDatabase(importDb, importPath);
    console.log(`Imported ${result.imported} rows (${result.skipped} skipped)`);
    break;
  }
  default:
    console.log("Usage: zubo <command>\n");
    console.log("Commands:");
    console.log("  setup              Configure Zubo (API keys, Telegram token)");
    console.log("  start              Start the Zubo agent");
    console.log("  start --daemon     Start in background");
    console.log("  stop               Stop the background daemon");
    console.log("  status             Show config and runtime status");
    console.log("  logs               Show last 50 log lines");
    console.log("  logs --follow      Stream logs live");
    console.log("  model              Show active LLM provider/model");
    console.log("  model <p/m>        Switch provider/model (e.g. ollama/llama3.3)");
    console.log("  model --list       List all configured providers");
    console.log("  skills             Manage skills (interactive menu)");
    console.log("  skills list        List installed skills");
    console.log("  skills new         Create a new skill");
    console.log("  skills reinstall   Reinstall built-in skills");
    console.log("  skills remove      Remove a skill");
    console.log("  install <skill>    Install a skill from the registry");
    console.log("  search <query>     Search the skill registry");
    console.log("  publish            How to publish a skill");
    console.log("  auth create-key    Create an API key");
    console.log("  auth list-keys     List all API keys");
    console.log("  auth delete-key    Delete an API key");
    console.log("  config set <k> <v> Set a config value");
    console.log("  config get [key]   Show config value(s)");
    console.log("  export             Export database as JSON");
    console.log("  export --format sqlite  Backup as SQLite file");
    console.log("  import <path>      Import data from JSON export");
    process.exit(1);
}
