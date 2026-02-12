import type { LlmToolDef } from "../llm/provider";

export interface ToolHandler {
  definition: LlmToolDef;
  execute: (input: Record<string, unknown>) => Promise<string>;
}

const tools = new Map<string, ToolHandler>();

export function registerTool(handler: ToolHandler) {
  tools.set(handler.definition.name, handler);
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
