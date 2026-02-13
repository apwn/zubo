import { readdirSync, readFileSync, existsSync, watch } from "fs";
import { join } from "path";
import { paths } from "../config/paths";
import { logger } from "../util/logger";
import { registerTool, getTool, unregisterTool } from "./registry";

/** Tracks all skill names loaded via loadSkills so hot-reload can unregister them. */
const loadedSkillNames = new Set<string>();

export interface SkillDef {
  name: string;
  description: string;
  inputSchema: Record<string, unknown>;
  dirPath: string;
}

export interface SkillParamDef {
  type: string;
  description?: string;
  required?: boolean;
}

export function paramsToJsonSchema(params: Record<string, SkillParamDef>): Record<string, unknown> {
  const properties: Record<string, { type: string; description?: string }> = {};
  const required: string[] = [];

  for (const [key, def] of Object.entries(params)) {
    properties[key] = { type: def.type || "string" };
    if (def.description) properties[key].description = def.description;
    if (def.required) required.push(key);
  }

  return { type: "object", properties, required };
}

export function parseSkillExport(
  skillConfig: { name: string; description: string; params?: Record<string, SkillParamDef> },
  dirPath: string
): SkillDef | null {
  const { name, description, params } = skillConfig;

  if (!name || !/^[a-z0-9_]+$/.test(name)) return null;
  if (!description) return null;

  const inputSchema = params ? paramsToJsonSchema(params) : { type: "object", properties: {}, required: [] };

  return { name, description, inputSchema, dirPath };
}

export function parseSkillMd(content: string, dirPath: string): SkillDef | null {
  const lines = content.split("\n");

  // H1 = tool name
  const h1Line = lines.find((l) => /^# /.test(l));
  if (!h1Line) return null;
  const name = h1Line.replace(/^# /, "").trim();
  if (!/^[a-z0-9_]+$/.test(name)) return null;

  // Description = text between H1 and first H2
  const h1Index = lines.indexOf(h1Line);
  let descLines: string[] = [];
  for (let i = h1Index + 1; i < lines.length; i++) {
    if (/^## /.test(lines[i])) break;
    descLines.push(lines[i]);
  }
  const description = descLines.join("\n").trim();
  if (!description) return null;

  // Input Schema = fenced JSON inside ## Input Schema
  let inputSchema: Record<string, unknown> = {
    type: "object",
    properties: {},
    required: [],
  };
  const schemaHeading = lines.findIndex((l) => /^## Input Schema/.test(l));
  if (schemaHeading !== -1) {
    let inFence = false;
    let jsonLines: string[] = [];
    for (let i = schemaHeading + 1; i < lines.length; i++) {
      if (/^## /.test(lines[i]) && !inFence) break;
      if (/^```/.test(lines[i])) {
        if (inFence) break;
        inFence = true;
        continue;
      }
      if (inFence) jsonLines.push(lines[i]);
    }
    if (jsonLines.length) {
      try {
        inputSchema = JSON.parse(jsonLines.join("\n"));
      } catch {
        // Fall back to empty schema
      }
    }
  }

  // Usage Hints (optional) = appended to description
  let fullDescription = description;
  const hintsHeading = lines.findIndex((l) => /^## Usage Hints/.test(l));
  if (hintsHeading !== -1) {
    let hintLines: string[] = [];
    for (let i = hintsHeading + 1; i < lines.length; i++) {
      if (/^## /.test(lines[i])) break;
      hintLines.push(lines[i]);
    }
    const hints = hintLines.join("\n").trim();
    if (hints) {
      fullDescription += "\n\n" + hints;
    }
  }

  return { name, description: fullDescription, inputSchema, dirPath };
}

export async function loadSkills(skillsDir: string): Promise<string[]> {
  if (!existsSync(skillsDir)) return [];

  const loaded: string[] = [];
  let entries: string[];

  try {
    entries = readdirSync(skillsDir);
  } catch {
    return [];
  }

  for (const entry of entries) {
    const dirPath = join(skillsDir, entry);
    const skillMdPath = join(dirPath, "SKILL.md");
    const handlerPath = join(dirPath, "handler.ts");

    if (!existsSync(handlerPath)) continue;

    try {
      let skill: SkillDef | null = null;
      let handler: ((input: Record<string, unknown>) => Promise<string>) | undefined;

      // Try SKILL.md first (backward compat)
      if (existsSync(skillMdPath)) {
        const mdContent = readFileSync(skillMdPath, "utf-8");
        skill = parseSkillMd(mdContent, dirPath);
        if (!skill) {
          logger.warn(
            `Skipping skill in ${entry}: invalid SKILL.md (name must match [a-z0-9_], description required)`
          );
          continue;
        }
      } else {
        // Single-file: read metadata from handler.ts exports
        const mod = await import(handlerPath + "?t=" + Date.now());
        if (mod.skill && typeof mod.skill === "object") {
          skill = parseSkillExport(mod.skill, dirPath);
          handler = mod.default;
          if (!skill) {
            logger.warn(
              `Skipping skill in ${entry}: invalid skill export (name must match [a-z0-9_], description required)`
            );
            continue;
          }
        } else {
          logger.warn(`Skipping skill in ${entry}: no SKILL.md and no exported skill config`);
          continue;
        }
      }

      // Warn on name collision
      if (getTool(skill.name)) {
        logger.warn(`Skill "${skill.name}" conflicts with existing tool, skipping`);
        continue;
      }

      // Dynamically import handler (if not already loaded from single-file path)
      if (!handler) {
        const mod = await import(handlerPath + "?t=" + Date.now());
        handler = mod.default;
      }
      if (typeof handler !== "function") {
        logger.warn(`Skipping skill "${skill.name}": handler.ts must export a default function`);
        continue;
      }

      // Wrap handler with validation: ensure it returns a string
      const rawHandler = handler;
      const safeHandler = async (input: Record<string, unknown>): Promise<string> => {
        const result = await rawHandler(input);
        if (typeof result !== "string") {
          logger.warn(`Skill "${skill.name}" returned ${typeof result}, expected string. Coercing to JSON.`);
          return JSON.stringify(result);
        }
        return result;
      };

      registerTool({
        definition: {
          name: skill.name,
          description: skill.description,
          input_schema: skill.inputSchema,
        },
        execute: safeHandler,
      }, true);

      loadedSkillNames.add(skill.name);
      loaded.push(skill.name);
    } catch (err: any) {
      logger.error(`Failed to load skill from ${entry}: ${err.message}`);
    }
  }

  return loaded;
}

/**
 * Unregisters all previously loaded skills, then reloads them from disk.
 * Used by the hot-reload watcher to pick up file changes.
 */
export async function reloadAllSkills(): Promise<string[]> {
  for (const name of loadedSkillNames) {
    unregisterTool(name);
  }
  loadedSkillNames.clear();

  return loadSkills(paths.skills);
}

/**
 * Watches the skills directory for file changes and reloads all skills
 * after a short debounce. Returns a cleanup function to stop watching.
 */
export function watchSkills(): () => void {
  const skillsDir = paths.skills;

  if (!existsSync(skillsDir)) {
    logger.warn("Skills directory does not exist, skipping hot-reload watcher");
    return () => {};
  }

  let debounceTimer: ReturnType<typeof setTimeout> | null = null;

  const watcher = watch(skillsDir, { recursive: true }, (_eventType, filename) => {
    if (debounceTimer) clearTimeout(debounceTimer);

    debounceTimer = setTimeout(async () => {
      logger.info("Skill file changed, reloading skills", { filename });
      try {
        const skillNames = await reloadAllSkills();
        logger.info("Skills reloaded successfully", { skills: skillNames });
      } catch (err: any) {
        logger.error("Failed to reload skills", { error: err.message });
      }
    }, 500);
  });

  logger.info("Skill hot-reload watcher started", { dir: skillsDir });

  return () => {
    if (debounceTimer) clearTimeout(debounceTimer);
    watcher.close();
  };
}
