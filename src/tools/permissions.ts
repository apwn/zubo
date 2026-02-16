export type ToolPermission = "auto" | "confirm" | "deny";

const DEFAULT_PERMISSIONS: Record<string, ToolPermission> = {
  // Built-in tools — always safe
  datetime: "auto",
  memory_write: "auto",
  memory_search: "auto",
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

/**
 * Returns the permission level for a tool.
 * Unknown tools (user-installed skills, MCP tools) default to "confirm"
 * to prevent untrusted code from running without user approval.
 */
export function getToolPermission(name: string): ToolPermission {
  return DEFAULT_PERMISSIONS[name] ?? "confirm";
}
