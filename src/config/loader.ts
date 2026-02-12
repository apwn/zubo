import { paths, ensureDirectories } from "./paths";
import { configSchema, type ZuboConfig } from "./schema";
import { existsSync } from "fs";

export async function loadConfig(): Promise<ZuboConfig> {
  if (!existsSync(paths.config)) {
    throw new Error(
      `Config not found at ${paths.config}. Run 'zubo setup' first.`
    );
  }
  const raw = await Bun.file(paths.config).json();
  return configSchema.parse(raw);
}

export async function saveConfig(config: ZuboConfig): Promise<void> {
  ensureDirectories();
  await Bun.write(paths.config, JSON.stringify(config, null, 2) + "\n");
}

export function configExists(): boolean {
  return existsSync(paths.config);
}
