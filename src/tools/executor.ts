import { getTool } from "./registry";
import { getToolPermission } from "./permissions";
import { logger } from "../util/logger";
import { executeSandboxed } from "./sandbox";

export interface ToolResult {
  tool_use_id: string;
  content: string;
  is_error: boolean;
}

// Server-side confirmation tracking — prevents LLM from spoofing _confirmed
const pendingConfirmations = new Map<string, { toolName: string; input: Record<string, unknown>; timestamp: number }>();

// Clean up stale confirmations older than 10 minutes
function cleanStaleConfirmations() {
  const cutoff = Date.now() - 10 * 60 * 1000;
  for (const [token, entry] of pendingConfirmations) {
    if (entry.timestamp < cutoff) pendingConfirmations.delete(token);
  }
}

// Determine if a tool should run in the sandbox (user-installed skills only)
async function shouldSandbox(
  toolName: string
): Promise<{ handlerPath: string; timeoutMs: number; env: Record<string, string> } | null> {
  try {
    const { isUserInstalledSkill } = await import("./registry");

    // Only sandbox tools that were loaded via the skill-loader from the user's skills directory
    if (!isUserInstalledSkill(toolName)) return null;

    const { existsSync, readFileSync } = await import("fs");
    const { join } = await import("path");
    const { paths } = await import("../config/paths");

    // Check if sandbox is enabled in config
    let timeoutMs = 30_000;
    try {
      const config = JSON.parse(readFileSync(paths.config, "utf-8"));
      if (config.sandbox?.enabled === false) return null;
      if (config.sandbox?.timeoutMs) timeoutMs = config.sandbox.timeoutMs;
    } catch {}

    // Resolve the handler path and read SKILL.md for declared secrets
    const skillDir = join(paths.skills, toolName);
    const handlerPath = join(skillDir, "handler.ts");
    if (!existsSync(handlerPath)) return null;

    // Only pass secrets that the skill actually references (grep handler for getSecret calls)
    const env: Record<string, string> = {};
    try {
      const { getDb } = await import("../db/connection");
      const db = getDb();
      const handlerCode = readFileSync(handlerPath, "utf-8");
      const rows = db.query("SELECT name, value FROM secrets").all() as { name: string; value: string }[];
      for (const row of rows) {
        // Only pass secrets referenced in the handler code
        if (handlerCode.includes(`"${row.name}"`) || handlerCode.includes(`'${row.name}'`)) {
          env[`ZUBO_SECRET_${row.name.toUpperCase()}`] = row.value;
        }
      }
    } catch {}

    return { handlerPath, timeoutMs, env };
  } catch {
    return null;
  }
}

export async function executeTool(
  name: string,
  toolUseId: string,
  input: Record<string, unknown>,
  allowedTools?: string[]
): Promise<ToolResult> {
  // Defense-in-depth: if an allowedTools set is provided (sub-agents),
  // reject any tool call not in the set, even if the LLM tries to call it.
  if (allowedTools && !allowedTools.includes(name)) {
    logger.warn(`Tool blocked by allowedTools: ${name}`);
    return {
      tool_use_id: toolUseId,
      content: `Error: Tool '${name}' is not available in this agent context.`,
      is_error: true,
    };
  }
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

  if (permission === "confirm") {
    cleanStaleConfirmations();

    // Check for a valid server-issued confirmation token
    const confirmToken = input._confirmToken as string | undefined;
    if (confirmToken) {
      const pending = pendingConfirmations.get(confirmToken);
      if (!pending || pending.toolName !== name) {
        return {
          tool_use_id: toolUseId,
          content: `Error: Invalid or expired confirmation token. The action was NOT executed. Please ask the user for approval again.`,
          is_error: true,
        };
      }
      // Valid token — clear it and proceed
      pendingConfirmations.delete(confirmToken);
    } else {
      // No token — generate one and request confirmation
      const { _confirmed, _confirmToken: _, ...displayInput } = input;
      const desc = JSON.stringify(displayInput, null, 2);
      const token = crypto.randomUUID();
      pendingConfirmations.set(token, { toolName: name, input: displayInput, timestamp: Date.now() });
      logger.info(`Tool requires confirmation: ${name}`);
      return {
        tool_use_id: toolUseId,
        content: `CONFIRMATION REQUIRED — tool was NOT executed.\n\nTool: ${name}\nInput: ${desc}\nConfirmation Token: ${token}\n\nThis tool requires user approval before it can run. Describe this action to the user and ask for their permission. Once they approve, call this tool again with _confirmToken set to "${token}" in the input.`,
        is_error: false,
      };
    }
  }

  const startTime = Date.now();
  try {
    const { _confirmed, _confirmToken, ...cleanInput } = input;
    logger.info(`Executing tool: ${name}`);

    // Check if this is a user-installed skill that should be sandboxed
    let result: any;
    const sandboxed = await shouldSandbox(name);
    if (sandboxed) {
      result = await executeSandboxed(sandboxed.handlerPath, cleanInput, {
        timeoutMs: sandboxed.timeoutMs,
        env: sandboxed.env,
      });
    } else {
      result = await tool.execute(cleanInput);
    }
    const durationMs = Date.now() - startTime;

    // Record tool metrics
    try {
      const { getDb } = await import("../db/connection");
      const db = getDb();
      db.prepare(
        "INSERT INTO tool_metrics (tool_name, duration_ms, success) VALUES (?, ?, 1)"
      ).run(name, durationMs);
    } catch {}

    return {
      tool_use_id: toolUseId,
      content: typeof result === "string" ? result : JSON.stringify(result),
      is_error: false,
    };
  } catch (err: any) {
    const durationMs = Date.now() - startTime;
    logger.error(`Tool error: ${name}`, { error: err.message });

    // Record failed tool metrics
    try {
      const { getDb } = await import("../db/connection");
      const db = getDb();
      db.prepare(
        "INSERT INTO tool_metrics (tool_name, duration_ms, success) VALUES (?, ?, 0)"
      ).run(name, durationMs);
    } catch {}

    return {
      tool_use_id: toolUseId,
      content: `Error: ${err.message}`,
      is_error: true,
    };
  }
}
