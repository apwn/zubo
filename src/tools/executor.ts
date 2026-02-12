import { getTool } from "./registry";
import { getToolPermission } from "./permissions";
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

  const permission = getToolPermission(name);

  if (permission === "deny") {
    logger.warn(`Tool denied: ${name}`);
    return {
      tool_use_id: toolUseId,
      content: `Error: Tool '${name}' is not permitted.`,
      is_error: true,
    };
  }

  if (permission === "confirm" && !input._confirmed) {
    const desc = JSON.stringify(input, null, 2);
    logger.info(`Tool requires confirmation: ${name}`, { input });
    return {
      tool_use_id: toolUseId,
      content: `CONFIRMATION REQUIRED — tool was NOT executed.\n\nTool: ${name}\nInput: ${desc}\n\nThis tool requires user approval before it can run. Describe this action to the user and ask for their permission. Once they approve, call this tool again with _confirmed set to true in the input.`,
      is_error: false,
    };
  }

  try {
    const { _confirmed, ...cleanInput } = input;
    logger.info(`Executing tool: ${name}`, { input: cleanInput });
    const result = await tool.execute(cleanInput);
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
