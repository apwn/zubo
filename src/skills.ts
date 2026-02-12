import { readdirSync, readFileSync, existsSync, rmSync } from "fs";
import { join } from "path";
import { mkdirSync, writeFileSync } from "fs";
import { paths } from "./config/paths";
import { parseSkillMd } from "./tools/skill-loader";
import { getBuiltinSkillNames, reinstallBuiltinSkill } from "./tools/skill-installer";

async function prompt(question: string): Promise<string> {
  process.stdout.write(question);
  for await (const line of console) {
    return line.trim();
  }
  return "";
}

function getInstalledSkills(): { name: string; status: string; description: string; folder: string }[] {
  if (!existsSync(paths.skills)) return [];

  let entries: string[];
  try {
    entries = readdirSync(paths.skills);
  } catch {
    return [];
  }

  const skills: { name: string; status: string; description: string; folder: string }[] = [];

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

    skills.push({ name, status, description: desc.slice(0, 60), folder: entry });
  }

  return skills;
}

function listSkills() {
  console.log("\n  Zubo Skills\n");

  const skills = getInstalledSkills();

  if (skills.length === 0) {
    console.log("  No skills installed.\n");
    console.log("  Drop skill folders into ~/.zubo/workspace/skills/");
    console.log("  Each folder needs SKILL.md + handler.ts\n");
    return;
  }

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

async function createSkillWizard() {
  console.log("\n  Create New Skill\n");

  const name = await prompt("  Tool name (lowercase, underscores only): ");
  if (!name || !/^[a-z0-9_]+$/.test(name)) {
    console.log("  Invalid name. Must match [a-z0-9_]+\n");
    return;
  }

  const destDir = join(paths.skills, name);
  if (existsSync(destDir)) {
    console.log(`  Skill "${name}" already exists.\n`);
    return;
  }

  const description = await prompt("  Description: ");
  if (!description) {
    console.log("  Description is required.\n");
    return;
  }

  // Collect parameters
  const properties: Record<string, { type: string; description: string }> = {};
  const required: string[] = [];

  console.log("\n  Add parameters (press Enter with empty name to finish):\n");

  while (true) {
    const paramName = await prompt("    Parameter name: ");
    if (!paramName) break;

    const paramType = await prompt("    Type [string]: ");
    const paramDesc = await prompt("    Description: ");
    const paramReq = await prompt("    Required? (y/N): ");

    properties[paramName] = {
      type: paramType || "string",
      description: paramDesc || "",
    };
    if (paramReq.toLowerCase() === "y") {
      required.push(paramName);
    }
    console.log("");
  }

  const inputSchema = {
    type: "object",
    properties,
    required,
  };

  // Generate SKILL.md
  const skillMd = `# ${name}

${description}

## Input Schema

\`\`\`json
${JSON.stringify(inputSchema, null, 2)}
\`\`\`

## Usage Hints

Use this tool when the user asks to ${description.toLowerCase()}.
`;

  // Generate handler.ts template
  const paramEntries = Object.entries(properties);
  const paramLines = paramEntries
    .map(([p, def]) => `  const ${p} = input.${p} as ${def.type === "number" ? "number" : "string"};`)
    .join("\n");

  const handlerTs = `export default async function (input: Record<string, unknown>): Promise<string> {
${paramLines || "  // Access parameters from input"}

  // TODO: Implement your skill logic here

  return JSON.stringify({ result: "Not yet implemented" });
}
`;

  // Write files
  mkdirSync(destDir, { recursive: true });
  writeFileSync(join(destDir, "SKILL.md"), skillMd);
  writeFileSync(join(destDir, "handler.ts"), handlerTs);

  console.log(`\n  Skill created at ~/.zubo/workspace/skills/${name}/`);
  console.log("  Files:");
  console.log(`    SKILL.md    — tool definition`);
  console.log(`    handler.ts  — implement your logic here`);
  console.log(`\n  Restart Zubo to load the new skill.\n`);
}

async function reinstallBuiltins() {
  console.log("\n  Reinstall Built-in Skills\n");

  const builtinNames = getBuiltinSkillNames();
  if (builtinNames.length === 0) {
    console.log("  No built-in skills found.\n");
    return;
  }

  console.log("  Available built-in skills:");
  for (const name of builtinNames) {
    const destDir = join(paths.skills, name);
    const status = existsSync(destDir) ? "(installed)" : "(missing)";
    console.log(`    - ${name} ${status}`);
  }

  const confirm = await prompt("\n  This will overwrite existing copies. Continue? (y/N): ");
  if (confirm.toLowerCase() !== "y") {
    console.log("  Cancelled.\n");
    return;
  }

  let count = 0;
  for (const name of builtinNames) {
    if (reinstallBuiltinSkill(paths.skills, name)) {
      count++;
    }
  }

  console.log(`\n  Reinstalled ${count} built-in skill(s).\n`);
}

async function removeSkill() {
  console.log("\n  Remove a Skill\n");

  const skills = getInstalledSkills();
  if (skills.length === 0) {
    console.log("  No skills installed.\n");
    return;
  }

  for (let i = 0; i < skills.length; i++) {
    console.log(`  ${i + 1}. ${skills[i].name}`);
  }

  const choice = await prompt(`\n  Remove which skill? [1-${skills.length}]: `);
  const idx = parseInt(choice, 10) - 1;
  if (isNaN(idx) || idx < 0 || idx >= skills.length) {
    console.log("  Invalid choice.\n");
    return;
  }

  const skill = skills[idx];
  const confirm = await prompt(`  Delete "${skill.name}"? This cannot be undone. (y/N): `);
  if (confirm.toLowerCase() !== "y") {
    console.log("  Cancelled.\n");
    return;
  }

  const dirPath = join(paths.skills, skill.folder);
  rmSync(dirPath, { recursive: true, force: true });
  console.log(`\n  Removed "${skill.name}".\n`);
}

async function showMenu() {
  console.log("\n  Zubo Skills\n");
  console.log("  1. List installed skills");
  console.log("  2. Create new skill");
  console.log("  3. Reinstall built-in skills");
  console.log("  4. Remove a skill");
  console.log("");

  const choice = await prompt("  Choice [1-4]: ");

  switch (choice) {
    case "1":
      listSkills();
      break;
    case "2":
      await createSkillWizard();
      break;
    case "3":
      await reinstallBuiltins();
      break;
    case "4":
      await removeSkill();
      break;
    default:
      console.log("  Invalid choice.\n");
  }
}

export async function runSkillsCommand(args: string[] = []) {
  const sub = args[0];

  switch (sub) {
    case "list":
      listSkills();
      break;
    case "new":
      await createSkillWizard();
      break;
    case "reinstall":
      await reinstallBuiltins();
      break;
    case "remove":
      await removeSkill();
      break;
    default:
      await showMenu();
  }
}
