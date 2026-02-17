import { getTool, isUserInstalledSkill } from "./registry";
import { getToolPermission, getToolScopes, hasRiskyScope } from "./permissions";
import { logger } from "../util/logger";
import { recordError } from "../util/error-buffer";
import { executeSandboxed } from "./sandbox";
import { paths } from "../config/paths";
import { readFileSync, statSync } from "fs";

/** Built-in integration tool names — these run in-process, NOT sandboxed,
 *  because they need access to Zubo.getGoogleToken and the OAuth module. */
const BUILTIN_INTEGRATION_TOOLS = new Set([
  "gmail", "google_calendar", "google_sheets", "google_docs", "google_drive",
  "github_issues", "github_prs", "github_repos",
  "notion_pages", "notion_databases", "notion_search",
  "linear_issues", "linear_projects",
  "jira_issues", "jira_boards",
  "slack_messages", "twitter_posts",
  "claude_code_task", "codex_task",
]);

interface ToolScopePolicy {
  allowed?: string[];
  dryRunByDefault: boolean;
  autoApproveFirstPartyTools: boolean;
}

const toolScopePolicyCache: {
  mtimeMs: number;
  value: ToolScopePolicy;
} = {
  mtimeMs: -1,
  value: { dryRunByDefault: false, autoApproveFirstPartyTools: false },
};

export interface ToolResult {
  tool_use_id: string;
  content: string;
  is_error: boolean;
}

export interface ExecuteToolOptions {
  directUserRequest?: boolean;
}

// Server-side confirmation tracking — prevents LLM from spoofing _confirmed
const pendingConfirmations = new Map<
  string,
  { toolName: string; inputHash: string; timestamp: number }
>();

// Clean up stale confirmations older than 10 minutes
function cleanStaleConfirmations() {
  const cutoff = Date.now() - 10 * 60 * 1000;
  for (const [token, entry] of pendingConfirmations) {
    if (entry.timestamp < cutoff) pendingConfirmations.delete(token);
  }
}

function stableStringify(value: unknown): string {
  if (value === null || typeof value !== "object") {
    return JSON.stringify(value);
  }
  if (Array.isArray(value)) {
    return `[${value.map((v) => stableStringify(v)).join(",")}]`;
  }
  const obj = value as Record<string, unknown>;
  const keys = Object.keys(obj).sort();
  return `{${keys.map((k) => `${JSON.stringify(k)}:${stableStringify(obj[k])}`).join(",")}}`;
}

function readToolScopePolicy(): ToolScopePolicy {
  try {
    const mtimeMs = statSync(paths.config).mtimeMs;
    if (toolScopePolicyCache.mtimeMs === mtimeMs) {
      return toolScopePolicyCache.value;
    }
    const cfg = JSON.parse(readFileSync(paths.config, "utf-8"));
    const parsed = {
      allowed: Array.isArray(cfg?.toolScopes?.allowed) ? cfg.toolScopes.allowed : undefined,
      dryRunByDefault: Boolean(cfg?.toolScopes?.dryRunByDefault),
      autoApproveFirstPartyTools: cfg?.approvals?.autoApproveFirstPartyTools === true,
    };
    toolScopePolicyCache.mtimeMs = mtimeMs;
    toolScopePolicyCache.value = parsed;
    return parsed;
  } catch {
    return { dryRunByDefault: false, autoApproveFirstPartyTools: false };
  }
}

function isFirstPartyTool(name: string): boolean {
  if (name.includes("__")) return false; // MCP tools
  return !isUserInstalledSkill(name);
}

// Determine if a tool should run in the sandbox (user-installed skills only)
async function shouldSandbox(
  toolName: string
): Promise<{ handlerPath: string; timeoutMs: number; env: Record<string, string> } | null> {
  try {
    const { isUserInstalledSkill } = await import("./registry");

    // Only sandbox tools that were loaded via the skill-loader from the user's skills directory
    if (!isUserInstalledSkill(toolName)) return null;

    // Built-in integrations run in-process — they need access to Zubo.getGoogleToken and OAuth
    if (BUILTIN_INTEGRATION_TOOLS.has(toolName)) return null;

    const { existsSync, readFileSync } = await import("fs");
    const { join } = await import("path");
    const { paths } = await import("../config/paths");

    // Sandbox is always enabled for user-installed skills — cannot be disabled.
    // Read timeout from config if set.
    let timeoutMs = 30_000;
    try {
      const config = JSON.parse(readFileSync(paths.config, "utf-8"));
      if (config.sandbox?.timeoutMs) timeoutMs = config.sandbox.timeoutMs;
    } catch (err: any) {
      logger.warn("Failed to read sandbox config", { error: (err as Error).message });
    }

    // Resolve the handler path
    const skillDir = join(paths.skills, toolName);
    const handlerPath = join(skillDir, "handler.ts");
    if (!existsSync(handlerPath)) return null;

    // Scope secrets: ONLY pass secrets explicitly declared in SKILL.md.
    // Skills without a secrets declaration get NO secrets — this prevents
    // malicious skills from accessing credentials they don't need.
    const env: Record<string, string> = {};
    try {
      const { getDb } = await import("../db/connection");
      const db = getDb();

      // Read declared secrets from SKILL.md (the ONLY source of truth)
      let declaredSecrets: Set<string> | null = null;
      try {
        const skillMdPath = join(skillDir, "SKILL.md");
        if (existsSync(skillMdPath)) {
          const skillMdContent = readFileSync(skillMdPath, "utf-8");
          const secretsMatch = skillMdContent.match(/^secrets:\s*(.+)/m);
          if (secretsMatch) {
            declaredSecrets = new Set(
              secretsMatch[1].split(",").map((s: string) => s.trim()).filter(Boolean)
            );
          }
        }
      } catch (err: any) {
        logger.warn("Failed to parse SKILL.md secrets declaration", { error: (err as Error).message });
      }

      if (declaredSecrets && declaredSecrets.size > 0) {
        const rows = db.query("SELECT name, value FROM secrets").all() as { name: string; value: string }[];
        for (const row of rows) {
          if (declaredSecrets.has(row.name)) {
            env[`ZUBO_SECRET_${row.name.toUpperCase()}`] = row.value;
          }
        }
      }
      // No declared secrets = no secrets passed. This is intentional.
    } catch (err: any) {
      logger.warn("Failed to resolve skill secrets for sandbox", { error: (err as Error).message });
    }

    return { handlerPath, timeoutMs, env };
  } catch {
    return null;
  }
}

export async function executeTool(
  name: string,
  toolUseId: string,
  input: Record<string, unknown>,
  allowedTools?: string[],
  options: ExecuteToolOptions = {}
): Promise<ToolResult> {
  // Defense-in-depth: if an allowedTools set is provided (sub-agents),
  // reject any tool call not in the set, even if the LLM tries to call it.
  if (allowedTools && !allowedTools.includes(name)) {
    logger.warn(`Tool blocked by allowedTools: ${name}`);
    return {
      tool_use_id: toolUseId,
      content: `Error: The '${name}' feature is not available right now.`,
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
  const scopes = getToolScopes(name);
  const scopePolicy = readToolScopePolicy();

  if (scopePolicy.allowed && scopePolicy.allowed.length > 0) {
    const blocked = scopes.filter((scope) => !scopePolicy.allowed!.includes(scope));
    if (blocked.length > 0) {
      return {
        tool_use_id: toolUseId,
        content:
          `Error: Tool '${name}' is blocked by tool scope policy. ` +
          `Blocked scopes: ${blocked.join(", ")}. ` +
          `Allowed scopes: ${scopePolicy.allowed.join(", ")}.`,
        is_error: true,
      };
    }
  }

  if (permission === "deny") {
    logger.warn(`Tool denied: ${name}`);
    return {
      tool_use_id: toolUseId,
      content: `Error: The '${name}' feature is not permitted. You can change permissions in Settings.`,
      is_error: true,
    };
  }

  const requestedDryRun = input._dryRun === true;
  const defaultDryRun = scopePolicy.dryRunByDefault && permission === "confirm" && hasRiskyScope(scopes);
  const dryRun = requestedDryRun || defaultDryRun;

  if (dryRun) {
    const { _confirmed, _confirmToken, _dryRun, ...previewInput } = input;
    return {
      tool_use_id: toolUseId,
      content:
        `DRY RUN ONLY — tool was NOT executed.\n\n` +
        `Tool: ${name}\n` +
        `Scopes: ${scopes.join(", ")}\n` +
        `Input: ${JSON.stringify(previewInput, null, 2)}\n\n` +
        `To execute for real, call again with _dryRun: false${permission === "confirm" ? " and include a valid _confirmToken after approval." : "."}`,
      is_error: false,
    };
  }

  if (permission === "confirm") {
    if (scopePolicy.autoApproveFirstPartyTools && isFirstPartyTool(name)) {
      logger.info(`Auto-approving first-party tool: ${name}`);
    } else
    // For direct user requests, don't require a second explicit approval round.
    if (options.directUserRequest) {
      logger.info(`Bypassing confirmation for direct user request: ${name}`);
    } else {
    cleanStaleConfirmations();

    // Check for a valid server-issued confirmation token
    const confirmToken = input._confirmToken as string | undefined;
    if (confirmToken) {
      const pending = pendingConfirmations.get(confirmToken);
      const { _confirmed, _confirmToken: _, _dryRun: __, ...displayInput } = input;
      const inputHash = stableStringify(displayInput);
      if (!pending || pending.toolName !== name || pending.inputHash !== inputHash) {
        return {
          tool_use_id: toolUseId,
          content: `Error: Invalid, mismatched, or expired confirmation token. The action was NOT executed. Please ask the user for approval again.`,
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
      pendingConfirmations.set(token, {
        toolName: name,
        inputHash: stableStringify(displayInput),
        timestamp: Date.now(),
      });
      logger.info(`Tool requires confirmation: ${name}`);
      return {
        tool_use_id: toolUseId,
        content: `CONFIRMATION REQUIRED — tool was NOT executed.\n\nTool: ${name}\nScopes: ${scopes.join(", ")}\nInput: ${desc}\nConfirmation Token: ${token}\n\nThis tool requires user approval before it can run. Describe this action to the user and ask for their permission. Once they approve, call this tool again with _confirmToken set to "${token}" in the input.`,
        is_error: false,
      };
    }
    }
  }

  const startTime = Date.now();
  try {
    const { _confirmed, _confirmToken, _dryRun, ...cleanInput } = input;
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
    } catch (err: any) {
      logger.warn("Failed to record tool success metrics", { error: (err as Error).message });
    }

    return {
      tool_use_id: toolUseId,
      content: typeof result === "string" ? result : JSON.stringify(result),
      is_error: false,
    };
  } catch (err: any) {
    const durationMs = Date.now() - startTime;
    logger.error(`Tool error: ${name}`, { error: err.message });
    recordError(`tool:${name}`, err.message);

    // Record failed tool metrics
    try {
      const { getDb } = await import("../db/connection");
      const db = getDb();
      db.prepare(
        "INSERT INTO tool_metrics (tool_name, duration_ms, success) VALUES (?, ?, 0)"
      ).run(name, durationMs);
    } catch (metricsErr: any) {
      logger.warn("Failed to record tool failure metrics", { error: (metricsErr as Error).message });
    }

    return {
      tool_use_id: toolUseId,
      content: `Error: ${err.message}`,
      is_error: true,
    };
  }
}
