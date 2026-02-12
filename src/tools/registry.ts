import type { LlmToolDef } from "../llm/provider";

export interface ToolHandler {
  definition: LlmToolDef;
  execute: (input: Record<string, unknown>) => Promise<string>;
}

const tools = new Map<string, ToolHandler>();

// Track which tools were loaded from the user skills directory (for sandboxing)
const userInstalledSkills = new Set<string>();

export function registerTool(handler: ToolHandler, isUserSkill: boolean = false) {
  tools.set(handler.definition.name, handler);
  if (isUserSkill) {
    userInstalledSkills.add(handler.definition.name);
  }
}

export function isUserInstalledSkill(name: string): boolean {
  return userInstalledSkills.has(name);
}

export function getTool(name: string): ToolHandler | undefined {
  return tools.get(name);
}

export function getAllToolDefs(): LlmToolDef[] {
  return Array.from(tools.values()).map((t) => t.definition);
}

export function unregisterTool(name: string): boolean {
  return tools.delete(name);
}

export function getAllTools(): Map<string, ToolHandler> {
  return tools;
}
