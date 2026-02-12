import { readdirSync, existsSync, readFileSync, mkdirSync, writeFileSync } from "fs";
import { join } from "path";

const BUILTIN_SKILLS_DIR = join(import.meta.dir, "builtin-skills");

export function getBuiltinSkillNames(): string[] {
  try {
    return readdirSync(BUILTIN_SKILLS_DIR).filter((entry) => {
      const srcDir = join(BUILTIN_SKILLS_DIR, entry);
      return existsSync(join(srcDir, "SKILL.md")) && existsSync(join(srcDir, "handler.ts"));
    });
  } catch {
    return [];
  }
}

export function reinstallBuiltinSkill(targetDir: string, skillName: string): boolean {
  const srcDir = join(BUILTIN_SKILLS_DIR, skillName);
  const destDir = join(targetDir, skillName);

  const skillMd = join(srcDir, "SKILL.md");
  const handlerTs = join(srcDir, "handler.ts");

  if (!existsSync(skillMd) || !existsSync(handlerTs)) return false;

  mkdirSync(destDir, { recursive: true });
  writeFileSync(join(destDir, "SKILL.md"), readFileSync(skillMd));
  writeFileSync(join(destDir, "handler.ts"), readFileSync(handlerTs));

  return true;
}

export function installBuiltinSkills(targetDir: string): string[] {
  if (!existsSync(targetDir)) {
    mkdirSync(targetDir, { recursive: true });
  }

  const installed: string[] = [];

  for (const entry of getBuiltinSkillNames()) {
    const destDir = join(targetDir, entry);

    // Skip if already exists (preserve user edits)
    if (existsSync(destDir)) continue;

    if (reinstallBuiltinSkill(targetDir, entry)) {
      installed.push(entry);
    }
  }

  return installed;
}
