import { getTool } from "./registry";
import { logger } from "../util/logger";

export interface ToolResult {
  tool_use_id: string;
  content: string;
  is_error: boolean;
}

export async function executeTool(
  name: string,
  toolUseId: string,
  input: Record<string, unknown>
): Promise<ToolResult> {
  const tool = getTool(name);
  if (!tool) {
    logger.error(`Tool not found: ${name}`);
    return {
      tool_use_id: toolUseId,
      content: `Error: Unknown tool '${name}'`,
      is_error: true,
    };
  }

  try {
    logger.info(`Executing tool: ${name}`, { input });
    const result = await tool.execute(input);
    return {
      tool_use_id: toolUseId,
      content: typeof result === "string" ? result : JSON.stringify(result),
      is_error: false,
    };
  } catch (err: any) {
    logger.error(`Tool error: ${name}`, { error: err.message });
    return {
      tool_use_id: toolUseId,
      content: `Error: ${err.message}`,
      is_error: true,
    };
  }
}
