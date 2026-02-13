import { existsSync, readdirSync, readFileSync, mkdirSync, writeFileSync, rmSync } from "fs";
import { join } from "path";
import { paths } from "../../config/paths";
import { registerTool, unregisterTool, getTool } from "../registry";
import { parseSkillMd, parseSkillExport, paramsToJsonSchema } from "../skill-loader";
import { logger } from "../../util/logger";

export function registerManageSkillsTool() {
  registerTool({
    definition: {
      name: "manage_skills",
      description:
        'Create, list, or remove skills (custom tools) at runtime. Use this when the user asks you to build, create, or make a new tool, skill, or utility — including phrases like "build a skill that...", "make me a tool to...", "create a skill for...". Also use for listing installed skills or removing one. Created skills are available immediately without restarting.',
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
              "JSON Schema for the tool's input parameters. Should have type, properties, and required fields. Use this OR params (simplified format).",
          },
          params: {
            type: "object",
            description:
              'Simplified parameter definitions. Each key is a param name with {type, description, required} fields. E.g. { "query": { "type": "string", "required": true } }. Use this OR input_schema.',
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
  const inputSchema = input.input_schema as Record<string, unknown> | undefined;
  const params = input.params as Record<string, { type: string; description?: string; required?: boolean }> | undefined;
  const handlerCode = input.handler_code as string;

  if (!name || !/^[a-z0-9_]+$/.test(name)) {
    return JSON.stringify({ error: "Invalid name. Must match [a-z0-9_]+" });
  }
  if (!description) {
    return JSON.stringify({ error: "Description is required." });
  }
  if (!handlerCode) {
    return JSON.stringify({ error: "handler_code is required." });
  }

  // Resolve the final input schema — accept either params shorthand or full input_schema
  let resolvedSchema: Record<string, unknown>;
  if (params) {
    resolvedSchema = paramsToJsonSchema(params);
  } else if (inputSchema) {
    resolvedSchema = inputSchema;
  } else {
    return JSON.stringify({ error: "Either params or input_schema is required." });
  }

  // Check for existing tool (built-in or skill)
  if (getTool(name)) {
    return JSON.stringify({ error: `A tool named "${name}" already exists.` });
  }

  const destDir = join(paths.skills, name);

  // Build params block for the skill config
  const escParam = (s: string) => s.replace(/\\/g, "\\\\").replace(/"/g, '\\"');
  let paramsLiteral = "{}";
  if (params) {
    const lines = Object.entries(params).map(([key, def]) => {
      const parts = [`type: "${def.type || "string"}"`];
      if (def.description) parts.push(`description: "${escParam(def.description)}"`);
      if (def.required) parts.push("required: true");
      return `    ${key}: { ${parts.join(", ")} }`;
    });
    paramsLiteral = `{\n${lines.join(",\n")}\n  }`;
  } else if (inputSchema) {
    // Convert full JSON Schema back to params shorthand for the file
    const props = (inputSchema as any).properties || {};
    const req = (inputSchema as any).required || [];
    const lines = Object.entries(props).map(([key, def]: [string, any]) => {
      const parts = [`type: "${escParam(Array.isArray(def.type) ? def.type[0] : (def.type || "string"))}"`];
      if (def.description) parts.push(`description: "${escParam(def.description)}"`);
      if (req.includes(key)) parts.push("required: true");
      return `    ${key}: { ${parts.join(", ")} }`;
    });
    paramsLiteral = lines.length ? `{\n${lines.join(",\n")}\n  }` : "{}";
  }

  // Generate single-file handler.ts with skill config prepended
  const esc = (s: string) => s.replace(/\\/g, "\\\\").replace(/"/g, '\\"');
  const skillHeader = `export const skill = {
  name: "${esc(name)}",
  description: "${esc(description)}",
  params: ${paramsLiteral}
};

`;

  const fullHandler = skillHeader + handlerCode;

  // Write files
  mkdirSync(destDir, { recursive: true });
  writeFileSync(join(destDir, "handler.ts"), fullHandler);

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
        input_schema: resolvedSchema,
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

    const hasHandler = existsSync(handlerPath);
    const hasSkillMd = existsSync(skillMdPath);

    if (!hasHandler && !hasSkillMd) continue;

    let name = entry;
    let description = "";
    let status = "error";

    if (hasSkillMd) {
      const mdContent = readFileSync(skillMdPath, "utf-8");
      const parsed = parseSkillMd(mdContent, dirPath);
      name = parsed?.name ?? entry;
      description = parsed?.description?.split("\n")[0] ?? "";
      status = parsed && hasHandler ? "ok" : "error";
    } else if (hasHandler) {
      try {
        const content = readFileSync(handlerPath, "utf-8");
        const nameMatch = content.match(/name\s*:\s*["']([^"']+)["']/);
        const descMatch = content.match(/description\s*:\s*["']([^"']+)["']/);
        if (nameMatch) name = nameMatch[1];
        if (descMatch) description = descMatch[1];
        status = "ok";
      } catch {
        status = "error";
      }
    }

    skills.push({ name, description, status });
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
    const handlerPath = join(dirPath, "handler.ts");

    if (entry === name) {
      targetFolder = entry;
      break;
    }

    if (existsSync(skillMdPath)) {
      const mdContent = readFileSync(skillMdPath, "utf-8");
      const parsed = parseSkillMd(mdContent, dirPath);
      if (parsed?.name === name) {
        targetFolder = entry;
        break;
      }
    } else if (existsSync(handlerPath)) {
      try {
        const content = readFileSync(handlerPath, "utf-8");
        const nameMatch = content.match(/name\s*:\s*["']([^"']+)["']/);
        if (nameMatch && nameMatch[1] === name) {
          targetFolder = entry;
          break;
        }
      } catch {
        // skip
      }
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
