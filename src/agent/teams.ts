import { existsSync, readFileSync, writeFileSync, readdirSync, unlinkSync } from "fs";
import { join } from "path";
import { paths } from "../config/paths";
import { logger } from "../util/logger";

export interface AgentTeam {
  name: string;
  description: string;
  agents: string[];
  defaultWorkflow?: string;
}

/**
 * Parse a TEAM.md file.
 *
 * Format:
 * # team_name
 * Description text
 *
 * ## Agents
 * - agent1
 * - agent2
 *
 * ## Default Workflow
 * workflow_name
 */
export function parseTeamMd(content: string): AgentTeam | null {
  const lines = content.split("\n");
  let name = "";
  let description = "";
  const agents: string[] = [];
  let defaultWorkflow: string | undefined;
  let section = "";

  for (const line of lines) {
    const trimmed = line.trim();

    if (trimmed.startsWith("# ") && !trimmed.startsWith("## ")) {
      name = trimmed.slice(2).trim();
      continue;
    }

    if (trimmed.startsWith("## Agents")) {
      section = "agents";
      continue;
    }

    if (trimmed.startsWith("## Default Workflow")) {
      section = "workflow";
      continue;
    }

    if (section === "" && !trimmed.startsWith("#") && trimmed) {
      description += (description ? " " : "") + trimmed;
    }

    if (section === "agents" && trimmed.startsWith("- ")) {
      agents.push(trimmed.slice(2).trim());
    }

    if (section === "workflow" && trimmed && !trimmed.startsWith("#")) {
      defaultWorkflow = trimmed;
    }
  }

  if (!name) return null;
  return { name, description, agents, defaultWorkflow };
}

export function loadTeams(): AgentTeam[] {
  const dir = paths.teams;
  if (!existsSync(dir)) return [];

  const results: AgentTeam[] = [];
  try {
    const files = readdirSync(dir);
    for (const file of files) {
      if (!file.endsWith(".md")) continue;
      const content = readFileSync(join(dir, file), "utf-8");
      const team = parseTeamMd(content);
      if (team) results.push(team);
    }
  } catch {}
  return results;
}

export function getTeam(name: string): AgentTeam | null {
  const filePath = join(paths.teams, `${name}.md`);
  if (!existsSync(filePath)) return null;
  return parseTeamMd(readFileSync(filePath, "utf-8"));
}

export function createTeam(team: AgentTeam): string {
  let md = `# ${team.name}\n${team.description}\n\n## Agents\n`;
  for (const agent of team.agents) {
    md += `- ${agent}\n`;
  }
  if (team.defaultWorkflow) {
    md += `\n## Default Workflow\n${team.defaultWorkflow}\n`;
  }

  const filePath = join(paths.teams, `${team.name}.md`);
  writeFileSync(filePath, md);
  logger.info(`Team created: ${team.name}`);
  return filePath;
}

export function removeTeam(name: string): boolean {
  const filePath = join(paths.teams, `${name}.md`);
  if (!existsSync(filePath)) return false;
  unlinkSync(filePath);
  logger.info(`Team removed: ${name}`);
  return true;
}
