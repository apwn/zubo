import { existsSync, mkdirSync, writeFileSync } from "fs";
import { join } from "path";
import { paths } from "../config/paths";
import { getRegistryEntry } from "./client";
import { logger } from "../util/logger";

export interface InstallResult {
  success: boolean;
  name: string;
  path?: string;
  requiredSecrets?: string[];
  error?: string;
}

export async function installFromRegistry(name: string): Promise<InstallResult> {
  // Validate skill name — only allow safe characters to prevent path traversal
  if (!/^[a-z0-9_-]+$/.test(name)) {
    return { success: false, name, error: "Invalid skill name — only lowercase letters, numbers, hyphens, and underscores allowed" };
  }

  const entry = await getRegistryEntry(name);
  if (!entry) {
    return { success: false, name, error: `Skill "${name}" not found in registry` };
  }

  const skillDir = join(paths.skills, name);
  // Verify resolved path stays within skills directory
  const { resolve } = await import("path");
  if (!resolve(skillDir).startsWith(resolve(paths.skills))) {
    return { success: false, name, error: "Path traversal detected" };
  }

  if (existsSync(skillDir)) {
    return { success: false, name, error: `Skill "${name}" is already installed` };
  }

  try {
    // Fetch SKILL.md from the repo
    const baseUrl = `https://raw.githubusercontent.com/${entry.repo}/main`;
    const [skillMdRes, handlerRes] = await Promise.all([
      fetch(`${baseUrl}/SKILL.md`),
      fetch(`${baseUrl}/handler.ts`),
    ]);

    if (!skillMdRes.ok || !handlerRes.ok) {
      return { success: false, name, error: `Failed to download skill files from ${entry.repo}` };
    }

    const skillMd = await skillMdRes.text();
    const handler = await handlerRes.text();

    mkdirSync(skillDir, { recursive: true });
    writeFileSync(join(skillDir, "SKILL.md"), skillMd);
    writeFileSync(join(skillDir, "handler.ts"), handler);

    logger.info(`Installed skill from registry: ${name}`);

    return {
      success: true,
      name,
      path: skillDir,
      requiredSecrets: entry.secrets,
    };
  } catch (err: any) {
    return { success: false, name, error: err.message };
  }
}
