import { existsSync, mkdirSync, writeFileSync } from "fs";
import { join, resolve } from "path";
import { paths } from "../config/paths";
import { getRegistryEntry } from "./client";
import { logger } from "../util/logger";

const REGISTRY_API = process.env.ZUBO_REGISTRY_URL || "https://zubo.bot/api/registry";

export interface InstallResult {
  success: boolean;
  name: string;
  path?: string;
  requiredSecrets?: string[];
  error?: string;
}

export async function installFromRegistry(name: string): Promise<InstallResult> {
  // Validate skill name
  if (!/^[a-z0-9_-]+$/.test(name)) {
    return { success: false, name, error: "Invalid skill name — only lowercase letters, numbers, hyphens, and underscores allowed" };
  }

  const entry = await getRegistryEntry(name);
  if (!entry) {
    return { success: false, name, error: `Skill "${name}" not found in registry` };
  }

  const skillDir = join(paths.skills, name);
  // Verify resolved path stays within skills directory
  if (!resolve(skillDir).startsWith(resolve(paths.skills))) {
    return { success: false, name, error: "Path traversal detected" };
  }

  if (existsSync(skillDir)) {
    return { success: false, name, error: `Skill "${name}" is already installed` };
  }

  try {
    // Fetch full skill detail from central API (includes handler_code)
    let handlerCode = entry.handler_code;
    let skillMd = entry.skill_md;

    if (!handlerCode) {
      // If handler_code wasn't in the list response, fetch the detail
      const detailRes = await fetch(`${REGISTRY_API}/skills/${entry.id}?install=true`);
      if (!detailRes.ok) {
        return { success: false, name, error: "Failed to download skill from registry" };
      }
      const detail = (await detailRes.json()) as { skill: any };
      handlerCode = detail.skill.handler_code;
      skillMd = detail.skill.skill_md;
    }

    if (!handlerCode) {
      return { success: false, name, error: "Skill has no handler code" };
    }

    mkdirSync(skillDir, { recursive: true });
    writeFileSync(join(skillDir, "handler.ts"), handlerCode);
    if (skillMd) {
      writeFileSync(join(skillDir, "SKILL.md"), skillMd);
    }

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
