import { readdirSync, readFileSync, existsSync } from "fs";
import { join } from "path";
import { paths } from "./config/paths";
import { parseSkillMd } from "./tools/skill-loader";

export function runSkillsCommand() {
  console.log("\n  Orba Skills\n");

  if (!existsSync(paths.skills)) {
    console.log("  No skills directory found. Run 'bun run setup' first.\n");
    return;
  }

  let entries: string[];
  try {
    entries = readdirSync(paths.skills);
  } catch {
    console.log("  Could not read skills directory.\n");
    return;
  }

  const skills: { name: string; status: string; description: string }[] = [];

  for (const entry of entries) {
    const dirPath = join(paths.skills, entry);
    const skillMdPath = join(dirPath, "SKILL.md");
    const handlerPath = join(dirPath, "handler.ts");

    if (!existsSync(skillMdPath)) continue;

    const mdContent = readFileSync(skillMdPath, "utf-8");
    const parsed = parseSkillMd(mdContent, dirPath);

    const hasHandler = existsSync(handlerPath);
    const status = parsed && hasHandler ? "ok" : "error";
    const name = parsed?.name ?? entry;
    const desc = parsed?.description?.split("\n")[0] ?? "—";

    skills.push({ name, status, description: desc.slice(0, 60) });
  }

  if (skills.length === 0) {
    console.log("  No skills installed.\n");
    console.log("  Drop skill folders into ~/.orba/workspace/skills/");
    console.log("  Each folder needs SKILL.md + handler.ts\n");
    return;
  }

  // Print table
  const nameW = Math.max(10, ...skills.map((s) => s.name.length)) + 2;
  const header = `  ${"Name".padEnd(nameW)}${"Status".padEnd(10)}Description`;
  console.log(header);
  console.log("  " + "-".repeat(header.length - 2));

  for (const s of skills) {
    const statusIcon = s.status === "ok" ? "ok" : "err";
    console.log(`  ${s.name.padEnd(nameW)}${statusIcon.padEnd(10)}${s.description}`);
  }

  console.log(`\n  ${skills.length} skill(s) installed.\n`);
}
