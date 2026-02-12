import { existsSync, readdirSync, readFileSync, mkdirSync, writeFileSync, rmSync } from "fs";
import { join } from "path";
import { paths } from "../config/paths";
import { logger } from "../util/logger";

export interface AgentDefinition {
  name: string;
  description: string;
  systemPrompt: string;
  tools: string[];
  dirPath: string;
}

/**
 * Parse an AGENT.md file into an AgentDefinition.
 * Format:
 *   # agent_name
 *   Description text
 *   ## System Prompt
 *   The system prompt...
 *   ## Tools
 *   - tool_name_1
 *   - tool_name_2
 */
export function parseAgentMd(content: string, dirPath: string): AgentDefinition | null {
  const lines = content.split("\n");

  // H1 = agent name
  const h1Line = lines.find((l) => /^# /.test(l));
  if (!h1Line) return null;
  const name = h1Line.replace(/^# /, "").trim();
  if (!/^[a-z0-9_]+$/.test(name)) return null;

  // Description = text between H1 and first H2
  const h1Index = lines.indexOf(h1Line);
  const descLines: string[] = [];
  for (let i = h1Index + 1; i < lines.length; i++) {
    if (/^## /.test(lines[i])) break;
    descLines.push(lines[i]);
  }
  const description = descLines.join("\n").trim();

  // System Prompt = text under ## System Prompt
  let systemPrompt = "";
  const spHeading = lines.findIndex((l) => /^## System Prompt/.test(l));
  if (spHeading !== -1) {
    const spLines: string[] = [];
    for (let i = spHeading + 1; i < lines.length; i++) {
      if (/^## /.test(lines[i])) break;
      spLines.push(lines[i]);
    }
    systemPrompt = spLines.join("\n").trim();
  }

  // Tools = list items under ## Tools
  const tools: string[] = [];
  const toolsHeading = lines.findIndex((l) => /^## Tools/.test(l));
  if (toolsHeading !== -1) {
    for (let i = toolsHeading + 1; i < lines.length; i++) {
      if (/^## /.test(lines[i])) break;
      const match = lines[i].match(/^[-*]\s+(\S+)/);
      if (match) tools.push(match[1]);
    }
  }

  return { name, description, systemPrompt, tools, dirPath };
}

/**
 * Load all agent definitions from the agents directory.
 */
export function loadAgentDefinitions(): AgentDefinition[] {
  const agentsDir = paths.agents;
  if (!existsSync(agentsDir)) return [];

  const agents: AgentDefinition[] = [];
  let entries: string[];

  try {
    entries = readdirSync(agentsDir);
  } catch {
    return [];
  }

  for (const entry of entries) {
    const dirPath = join(agentsDir, entry);
    const agentMdPath = join(dirPath, "AGENT.md");

    if (!existsSync(agentMdPath)) continue;

    try {
      const content = readFileSync(agentMdPath, "utf-8");
      const agent = parseAgentMd(content, dirPath);
      if (agent) {
        agents.push(agent);
      } else {
        logger.warn(`Skipping agent in ${entry}: invalid AGENT.md`);
      }
    } catch (err: any) {
      logger.error(`Failed to load agent from ${entry}: ${err.message}`);
    }
  }

  return agents;
}

/**
 * Get a specific agent definition by name.
 */
export function getAgentDefinition(name: string): AgentDefinition | null {
  const agents = loadAgentDefinitions();
  return agents.find((a) => a.name === name) ?? null;
}

/**
 * Create a new agent definition.
 */
export function createAgentDefinition(
  name: string,
  description: string,
  systemPrompt: string,
  tools: string[]
): AgentDefinition {
  const agentsDir = paths.agents;
  const dirPath = join(agentsDir, name);
  mkdirSync(dirPath, { recursive: true });

  const toolList = tools.map((t) => `- ${t}`).join("\n");

  const content = `# ${name}

${description}

## System Prompt

${systemPrompt}

## Tools

${toolList}
`;

  writeFileSync(join(dirPath, "AGENT.md"), content);
  logger.info(`Agent "${name}" created at ${dirPath}`);

  return { name, description, systemPrompt, tools, dirPath };
}

/**
 * Remove an agent definition.
 */
export function removeAgentDefinition(name: string): boolean {
  const agent = getAgentDefinition(name);
  if (!agent) return false;

  rmSync(agent.dirPath, { recursive: true, force: true });
  logger.info(`Agent "${name}" removed`);
  return true;
}
