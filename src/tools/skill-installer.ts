import { readdirSync, existsSync, readFileSync, mkdirSync, writeFileSync } from "fs";
import { join } from "path";

const BUILTIN_SKILLS_DIR = join(import.meta.dir, "builtin-skills");

export function installBuiltinSkills(targetDir: string): string[] {
  if (!existsSync(targetDir)) {
    mkdirSync(targetDir, { recursive: true });
  }

  let entries: string[];
  try {
    entries = readdirSync(BUILTIN_SKILLS_DIR);
  } catch {
    return [];
  }

  const installed: string[] = [];

  for (const entry of entries) {
    const srcDir = join(BUILTIN_SKILLS_DIR, entry);
    const destDir = join(targetDir, entry);

    // Skip if already exists (preserve user edits)
    if (existsSync(destDir)) continue;

    const skillMd = join(srcDir, "SKILL.md");
    const handlerTs = join(srcDir, "handler.ts");

    if (!existsSync(skillMd) || !existsSync(handlerTs)) continue;

    mkdirSync(destDir, { recursive: true });
    writeFileSync(join(destDir, "SKILL.md"), readFileSync(skillMd));
    writeFileSync(join(destDir, "handler.ts"), readFileSync(handlerTs));

    installed.push(entry);
  }

  return installed;
}
