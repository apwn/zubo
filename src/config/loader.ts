import { paths, ensureDirectories } from "./paths";
import { configSchema, type OrbaConfig } from "./schema";
import { existsSync } from "fs";

export async function loadConfig(): Promise<OrbaConfig> {
  if (!existsSync(paths.config)) {
    throw new Error(
      `Config not found at ${paths.config}. Run 'orba setup' first.`
    );
  }
  const raw = await Bun.file(paths.config).json();
  return configSchema.parse(raw);
}

export async function saveConfig(config: OrbaConfig): Promise<void> {
  ensureDirectories();
  await Bun.write(paths.config, JSON.stringify(config, null, 2) + "\n");
}

export function configExists(): boolean {
  return existsSync(paths.config);
}
