import { existsSync, readFileSync, writeFileSync } from "fs";
import { paths } from "./config/paths";
import { configExists } from "./config/loader";

function readConfig(): any {
  if (!configExists()) {
    console.log("Config not found. Run 'zubo setup' first.");
    process.exit(1);
  }
  return JSON.parse(readFileSync(paths.config, "utf-8"));
}

function writeConfig(config: any) {
  writeFileSync(paths.config, JSON.stringify(config, null, 2) + "\n");
}

function showCurrent() {
  const config = readConfig();

  if (config.providers && config.activeProvider) {
    const active = config.providers[config.activeProvider];
    console.log(`\n  Active: ${config.activeProvider}/${active?.model ?? "?"}`);

    if (config.failover?.length) {
      const fallbacks = config.failover
        .map((name: string) => {
          const p = config.providers?.[name];
          return p ? `${name}/${p.model}` : `${name} (not configured)`;
        })
        .join(", ");
      console.log(`  Failover: ${fallbacks}`);
    }
  } else if (config.anthropicApiKey) {
    console.log(`\n  Active: anthropic/${config.model ?? "claude-sonnet-4-5-20250929"} (legacy config)`);
  } else {
    console.log("\n  No provider configured.");
  }
  console.log("");
}

function listProviders() {
  const config = readConfig();

  console.log("\n  Configured Providers\n");

  if (config.providers) {
    for (const [name, p] of Object.entries(config.providers) as [string, any][]) {
      const active = name === config.activeProvider ? " ← active" : "";
      const failover = config.failover?.includes(name) ? " (failover)" : "";
      const baseUrl = p.baseUrl ? ` @ ${p.baseUrl}` : "";
      console.log(`  ${name}/${p.model}${baseUrl}${active}${failover}`);
    }
  } else if (config.anthropicApiKey) {
    console.log(`  anthropic/${config.model ?? "claude-sonnet-4-5-20250929"} ← active (legacy)`);
  } else {
    console.log("  None configured.");
  }
  console.log("");
}

function switchModel(target: string) {
  const config = readConfig();

  // Parse "provider/model" or just "provider"
  const slashIdx = target.indexOf("/");
  let providerName: string;
  let modelName: string | null;

  if (slashIdx > 0) {
    providerName = target.substring(0, slashIdx);
    modelName = target.substring(slashIdx + 1);
  } else {
    providerName = target;
    modelName = null;
  }

  // Ensure providers object exists
  if (!config.providers) {
    config.providers = {};
  }

  // Check if this provider is already configured
  if (config.providers[providerName]) {
    config.activeProvider = providerName;
    if (modelName) {
      config.providers[providerName].model = modelName;
    }
    // Keep legacy field in sync
    config.model = config.providers[providerName].model;

    writeConfig(config);
    console.log(`Switched to ${providerName}/${config.providers[providerName].model}`);
    console.log("Restart Zubo for changes to take effect.");
    return;
  }

  // Provider not configured — offer quick setup for known providers
  console.log(`Provider "${providerName}" is not configured.`);
  console.log(`Run 'zubo setup' to add it, or edit ~/.zubo/config.json directly.`);
  process.exit(1);
}

export function runModelCommand(args: string[]) {
  if (args.includes("--list") || args.includes("-l")) {
    listProviders();
    return;
  }

  // If a target is given, switch to it
  const target = args.find((a) => !a.startsWith("-"));
  if (target) {
    switchModel(target);
    return;
  }

  // Default: show current
  showCurrent();
}
