import { existsSync, readdirSync, readFileSync, mkdirSync, writeFileSync, rmSync } from "fs";
import { join } from "path";
import { paths } from "../../config/paths";
import { registerTool, unregisterTool, getTool } from "../registry";
import { parseSkillMd } from "../skill-loader";
import { logger } from "../../util/logger";

export function registerManageSkillsTool() {
  registerTool({
    definition: {
      name: "manage_skills",
      description:
        "Create, list, or remove skills (custom tools) at runtime. Use this when the user asks you to create a new tool/skill, list installed skills, or remove one. Created skills are available immediately without restarting.",
      input_schema: {
        type: "object",
        properties: {
          action: {
            type: "string",
            enum: ["create", "list", "remove"],
            description: "The action to perform.",
          },
          name: {
            type: "string",
            description: "Skill name (lowercase, underscores only). Required for create and remove.",
          },
          description: {
            type: "string",
            description: "What the skill does. Required for create.",
          },
          input_schema: {
            type: "object",
            description:
              "JSON Schema for the tool's input parameters. Should have type, properties, and required fields. Required for create.",
          },
          handler_code: {
            type: "string",
            description:
              'TypeScript code for handler.ts. Must export a default async function that takes Record<string, unknown> and returns a Promise<string>. Required for create. Example: \'export default async function (input: Record<string, unknown>): Promise<string> { return JSON.stringify({ result: "hello" }); }\'',
          },
        },
        required: ["action"],
      },
    },
    execute: async (input) => {
      const action = input.action as string;

      switch (action) {
        case "create":
          return await createSkill(input);
        case "list":
          return listSkills();
        case "remove":
          return removeSkill(input);
        default:
          return JSON.stringify({ error: `Unknown action: ${action}` });
      }
    },
  });
}

async function createSkill(input: Record<string, unknown>): Promise<string> {
  const name = input.name as string;
  const description = input.description as string;
  const inputSchema = input.input_schema as Record<string, unknown>;
  const handlerCode = input.handler_code as string;

  if (!name || !/^[a-z0-9_]+$/.test(name)) {
    return JSON.stringify({ error: "Invalid name. Must match [a-z0-9_]+" });
  }
  if (!description) {
    return JSON.stringify({ error: "Description is required." });
  }
  if (!inputSchema) {
    return JSON.stringify({ error: "input_schema is required." });
  }
  if (!handlerCode) {
    return JSON.stringify({ error: "handler_code is required." });
  }

  // Check for existing tool (built-in or skill)
  if (getTool(name)) {
    return JSON.stringify({ error: `A tool named "${name}" already exists.` });
  }

  const destDir = join(paths.skills, name);

  // Generate SKILL.md
  const skillMd = `# ${name}

${description}

## Input Schema

\`\`\`json
${JSON.stringify(inputSchema, null, 2)}
\`\`\`
`;

  // Write files
  mkdirSync(destDir, { recursive: true });
  writeFileSync(join(destDir, "SKILL.md"), skillMd);
  writeFileSync(join(destDir, "handler.ts"), handlerCode);

  // Hot-reload: dynamically import and register
  try {
    const handlerPath = join(destDir, "handler.ts");
    const mod = await import(handlerPath);
    const handler = mod.default;

    if (typeof handler !== "function") {
      return JSON.stringify({
        error: "handler_code must export a default function.",
        files_written: true,
      });
    }

    registerTool({
      definition: {
        name,
        description,
        input_schema: inputSchema,
      },
      execute: handler,
    });

    logger.info(`Skill "${name}" created and registered at runtime`);
    return JSON.stringify({
      success: true,
      name,
      message: `Skill "${name}" created and available immediately.`,
    });
  } catch (err: any) {
    logger.error(`Failed to hot-load skill "${name}": ${err.message}`);
    return JSON.stringify({
      error: `Files written but failed to load handler: ${err.message}`,
      files_written: true,
    });
  }
}

function listSkills(): string {
  if (!existsSync(paths.skills)) {
    return JSON.stringify({ skills: [] });
  }

  let entries: string[];
  try {
    entries = readdirSync(paths.skills);
  } catch {
    return JSON.stringify({ skills: [] });
  }

  const skills: { name: string; description: string; status: string }[] = [];

  for (const entry of entries) {
    const dirPath = join(paths.skills, entry);
    const skillMdPath = join(dirPath, "SKILL.md");
    const handlerPath = join(dirPath, "handler.ts");

    if (!existsSync(skillMdPath)) continue;

    const mdContent = readFileSync(skillMdPath, "utf-8");
    const parsed = parseSkillMd(mdContent, dirPath);
    const hasHandler = existsSync(handlerPath);

    skills.push({
      name: parsed?.name ?? entry,
      description: parsed?.description?.split("\n")[0] ?? "",
      status: parsed && hasHandler ? "ok" : "error",
    });
  }

  return JSON.stringify({ skills, count: skills.length });
}

function removeSkill(input: Record<string, unknown>): string {
  const name = input.name as string;
  if (!name) {
    return JSON.stringify({ error: "Skill name is required for remove." });
  }

  // Find the skill folder (folder name might differ from tool name)
  if (!existsSync(paths.skills)) {
    return JSON.stringify({ error: "No skills directory found." });
  }

  let entries: string[];
  try {
    entries = readdirSync(paths.skills);
  } catch {
    return JSON.stringify({ error: "Could not read skills directory." });
  }

  let targetFolder: string | null = null;
  for (const entry of entries) {
    const dirPath = join(paths.skills, entry);
    const skillMdPath = join(dirPath, "SKILL.md");
    if (!existsSync(skillMdPath)) continue;

    const mdContent = readFileSync(skillMdPath, "utf-8");
    const parsed = parseSkillMd(mdContent, dirPath);
    if (parsed?.name === name || entry === name) {
      targetFolder = entry;
      break;
    }
  }

  if (!targetFolder) {
    return JSON.stringify({ error: `Skill "${name}" not found.` });
  }

  const dirPath = join(paths.skills, targetFolder);
  rmSync(dirPath, { recursive: true, force: true });
  unregisterTool(name);

  logger.info(`Skill "${name}" removed`);
  return JSON.stringify({
    success: true,
    name,
    message: `Skill "${name}" removed.`,
  });
}
