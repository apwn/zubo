import { existsSync, readFileSync, writeFileSync, readdirSync, unlinkSync } from "fs";
import { join } from "path";
import { paths } from "../config/paths";
import { logger } from "../util/logger";

export interface WorkflowStep {
  name: string;
  agent: string;
  task: string;
  dependsOn: string[];
  outputVar?: string;
}

export interface WorkflowDefinition {
  name: string;
  description: string;
  agents: string[];
  steps: WorkflowStep[];
}

/**
 * Parse a WORKFLOW.md file into a WorkflowDefinition.
 *
 * Format:
 * # workflow_name
 * Description text
 *
 * ## Agents
 * - agent1
 * - agent2
 *
 * ## Steps
 * ### step_name
 * - agent: agent1
 * - task: Do something with $input
 * - dependsOn: step_other
 * - output: result_var
 */
export function parseWorkflowMd(content: string): WorkflowDefinition | null {
  const lines = content.split("\n");
  let name = "";
  let description = "";
  const agents: string[] = [];
  const steps: WorkflowStep[] = [];
  let section = "";
  let currentStep: Partial<WorkflowStep> | null = null;

  for (const line of lines) {
    const trimmed = line.trim();

    if (trimmed.startsWith("# ") && !trimmed.startsWith("## ") && !trimmed.startsWith("### ")) {
      name = trimmed.slice(2).trim();
      continue;
    }

    if (trimmed.startsWith("## Agents")) {
      section = "agents";
      continue;
    }

    if (trimmed.startsWith("## Steps")) {
      section = "steps";
      continue;
    }

    if (trimmed.startsWith("### ") && section === "steps") {
      if (currentStep?.name) {
        steps.push(finalizeStep(currentStep));
      }
      currentStep = { name: trimmed.slice(4).trim(), dependsOn: [] };
      continue;
    }

    if (section === "" && !trimmed.startsWith("#") && trimmed) {
      description += (description ? " " : "") + trimmed;
      continue;
    }

    if (section === "agents" && trimmed.startsWith("- ")) {
      agents.push(trimmed.slice(2).trim());
      continue;
    }

    if (section === "steps" && currentStep && trimmed.startsWith("- ")) {
      const content = trimmed.slice(2);
      const colonIdx = content.indexOf(":");
      if (colonIdx !== -1) {
        const key = content.slice(0, colonIdx).trim().toLowerCase();
        const value = content.slice(colonIdx + 1).trim();
        if (key === "agent") currentStep.agent = value;
        else if (key === "task") currentStep.task = value;
        else if (key === "dependson" || key === "depends_on") {
          currentStep.dependsOn = value.split(",").map((s) => s.trim()).filter(Boolean);
        } else if (key === "output") currentStep.outputVar = value;
      }
    }
  }

  if (currentStep?.name) {
    steps.push(finalizeStep(currentStep));
  }

  if (!name) return null;

  return { name, description, agents, steps };
}

function finalizeStep(partial: Partial<WorkflowStep>): WorkflowStep {
  return {
    name: partial.name ?? "unnamed",
    agent: partial.agent ?? "main",
    task: partial.task ?? "",
    dependsOn: partial.dependsOn ?? [],
    outputVar: partial.outputVar,
  };
}

export function loadWorkflowDefinitions(): WorkflowDefinition[] {
  const dir = paths.workflows;
  if (!existsSync(dir)) return [];

  const results: WorkflowDefinition[] = [];
  try {
    const files = readdirSync(dir);
    for (const file of files) {
      if (!file.endsWith(".md")) continue;
      const content = readFileSync(join(dir, file), "utf-8");
      const def = parseWorkflowMd(content);
      if (def) results.push(def);
    }
  } catch (err: any) {
    logger.warn("Failed to load workflow definitions", { error: (err as Error).message });
  }
  return results;
}

export function getWorkflowDefinition(name: string): WorkflowDefinition | null {
  const filePath = join(paths.workflows, `${name}.md`);
  if (!existsSync(filePath)) return null;
  const content = readFileSync(filePath, "utf-8");
  return parseWorkflowMd(content);
}

export function createWorkflowDefinition(def: WorkflowDefinition): string {
  let md = `# ${def.name}\n${def.description}\n\n## Agents\n`;
  for (const agent of def.agents) {
    md += `- ${agent}\n`;
  }
  md += `\n## Steps\n`;
  for (const step of def.steps) {
    md += `### ${step.name}\n`;
    md += `- agent: ${step.agent}\n`;
    md += `- task: ${step.task}\n`;
    if (step.dependsOn.length) {
      md += `- dependsOn: ${step.dependsOn.join(", ")}\n`;
    }
    if (step.outputVar) {
      md += `- output: ${step.outputVar}\n`;
    }
    md += `\n`;
  }

  const filePath = join(paths.workflows, `${def.name}.md`);
  writeFileSync(filePath, md);
  logger.info(`Workflow created: ${def.name}`);
  return filePath;
}

export function removeWorkflowDefinition(name: string): boolean {
  const filePath = join(paths.workflows, `${name}.md`);
  if (!existsSync(filePath)) return false;
  unlinkSync(filePath);
  logger.info(`Workflow removed: ${name}`);
  return true;
}
