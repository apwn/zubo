export type ToolPermission = "auto" | "confirm" | "deny";
import { readFileSync, statSync } from "fs";
import { paths } from "../config/paths";
export type ToolScope =
  | "memory"
  | "config"
  | "scheduling"
  | "secrets"
  | "delegation"
  | "network_read"
  | "network_write"
  | "filesystem_read"
  | "filesystem_write"
  | "execution"
  | "oauth"
  | "custom";

const DEFAULT_PERMISSIONS: Record<string, ToolPermission> = {
  // Built-in tools — always safe
  datetime: "auto",
  memory_write: "auto",
  memory_search: "auto",
  memory_prune: "confirm",
  cron_list: "auto",
  reminder_set: "auto",
  diagnose: "auto",

  // Secrets — set/list/get are safe, delete requires confirmation
  secret_set: "auto",
  secret_get: "auto",
  secret_list: "auto",
  secret_delete: "confirm",

  // Config — auto (tool has built-in guards: blocks secrets, security settings, validates via schema)
  config_update: "auto",
  connect_service: "confirm",

  // Agent delegation — delegate is auto, but creating/managing agents requires confirmation
  delegate: "auto",
  delegate_task: "auto",
  manage_agents: "confirm",
  manage_skills: "confirm",

  // Scheduling — creating cron jobs requires confirmation (runs code unattended)
  cron_create: "confirm",
  cron_delete: "confirm",

  // Knowledge graph
  kg_query: "auto",
  kg_update: "auto",

  // Personal features — safe (user-facing data management)
  todos: "auto",
  notes: "auto",
  preferences: "auto",
  topics: "auto",
  follow_ups: "auto",
  email_send: "confirm",

  // Built-in skills — safe (read-only or low risk)
  web_search: "auto",
  url_fetch: "auto",
  file_read: "auto",
  image_generate: "auto",
  google_oauth: "auto",

  // Integration skills — auto because user explicitly requests these actions
  gmail: "auto",
  google_calendar: "auto",
  google_sheets: "auto",
  google_docs: "auto",
  google_drive: "auto",
  github_issues: "auto",
  github_repos: "auto",
  github_prs: "auto",
  notion_pages: "auto",
  linear_issues: "auto",
  jira_issues: "auto",
  slack_messages: "auto",

  // Built-in skills — require confirmation (network writes, code execution, system access)
  http_request: "confirm",
  code_interpreter: "confirm",
  shell: "confirm",
  file_write: "confirm",
  webhook_manage: "confirm",
  oauth_manage: "confirm",
  skill_registry: "confirm",

  // Integration skills — posting requires confirmation
  twitter_posts: "confirm",
};

const permissionCache: {
  mtimeMs: number;
  overrides: Record<string, ToolPermission>;
} = {
  mtimeMs: -1,
  overrides: {},
};

function getPermissionOverrides(): Record<string, ToolPermission> {
  try {
    const mtimeMs = statSync(paths.config).mtimeMs;
    if (permissionCache.mtimeMs === mtimeMs) return permissionCache.overrides;
    const cfg = JSON.parse(readFileSync(paths.config, "utf-8"));
    const raw = cfg?.toolPermissions ?? {};
    const parsed: Record<string, ToolPermission> = {};
    for (const [k, v] of Object.entries(raw)) {
      if (v === "auto" || v === "confirm" || v === "deny") {
        parsed[k] = v;
      }
    }
    permissionCache.mtimeMs = mtimeMs;
    permissionCache.overrides = parsed;
    return parsed;
  } catch {
    return permissionCache.overrides;
  }
}

const TOOL_SCOPES: Record<string, ToolScope[]> = {
  datetime: ["memory"],
  memory_write: ["memory"],
  memory_search: ["memory"],
  memory_prune: ["memory"],
  cron_list: ["scheduling"],
  cron_create: ["scheduling"],
  cron_delete: ["scheduling"],
  reminder_set: ["scheduling"],
  diagnose: ["config"],
  secret_set: ["secrets"],
  secret_get: ["secrets"],
  secret_list: ["secrets"],
  secret_delete: ["secrets"],
  config_update: ["config"],
  connect_service: ["oauth"],
  delegate: ["delegation"],
  delegate_task: ["delegation"],
  manage_agents: ["delegation"],
  manage_skills: ["config"],
  kg_query: ["memory"],
  kg_update: ["memory"],
  todos: ["memory"],
  notes: ["memory"],
  preferences: ["memory"],
  topics: ["memory"],
  follow_ups: ["memory"],
  email_send: ["network_write"],
  web_search: ["network_read"],
  url_fetch: ["network_read"],
  file_read: ["filesystem_read"],
  image_generate: ["network_write"],
  google_oauth: ["oauth"],
  http_request: ["network_write"],
  code_interpreter: ["execution"],
  shell: ["execution"],
  file_write: ["filesystem_write"],
  webhook_manage: ["network_write"],
  oauth_manage: ["oauth"],
  skill_registry: ["network_write"],
  gmail: ["network_read", "network_write"],
  google_calendar: ["network_read", "network_write"],
  google_sheets: ["network_read", "network_write"],
  google_docs: ["network_read", "network_write"],
  google_drive: ["network_read", "network_write"],
  github_issues: ["network_read", "network_write"],
  github_repos: ["network_read"],
  github_prs: ["network_read", "network_write"],
  notion_pages: ["network_read", "network_write"],
  notion_databases: ["network_read"],
  notion_search: ["network_read"],
  linear_issues: ["network_read", "network_write"],
  linear_projects: ["network_read"],
  jira_issues: ["network_read", "network_write"],
  jira_boards: ["network_read"],
  slack_messages: ["network_read", "network_write"],
  twitter_posts: ["network_write"],
  claude_code_task: ["execution"],
  codex_task: ["execution"],
};

/**
 * Returns the permission level for a tool.
 * Unknown tools (user-installed skills, MCP tools) default to "confirm"
 * to prevent untrusted code from running without user approval.
 */
export function getToolPermission(name: string): ToolPermission {
  const overrides = getPermissionOverrides();
  if (overrides[name]) return overrides[name];
  return DEFAULT_PERMISSIONS[name] ?? "confirm";
}

export function getToolScopes(name: string): ToolScope[] {
  return TOOL_SCOPES[name] ?? ["custom"];
}

export function hasRiskyScope(scopes: ToolScope[]): boolean {
  return scopes.some((s) =>
    s === "network_write" ||
    s === "filesystem_write" ||
    s === "execution" ||
    s === "oauth" ||
    s === "secrets"
  );
}
