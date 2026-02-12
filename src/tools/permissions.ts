export type ToolPermission = "auto" | "confirm" | "deny";

const DEFAULT_PERMISSIONS: Record<string, ToolPermission> = {
  // Built-in tools — always safe
  datetime: "auto",
  memory_write: "auto",
  memory_search: "auto",
  manage_skills: "auto",
  cron_create: "auto",
  cron_list: "auto",
  cron_delete: "auto",

  // Secrets — set/list are safe, delete requires confirmation
  secret_set: "auto",
  secret_list: "auto",
  secret_delete: "confirm",

  // Integrations
  connect_service: "auto",

  // Agent delegation
  delegate: "auto",
  manage_agents: "auto",

  // Built-in skills — safe
  web_search: "auto",
  url_fetch: "auto",
  file_read: "auto",
  http_request: "auto",

  // Built-in skills — potentially dangerous
  shell: "confirm",
  file_write: "confirm",

  // Integration skills — posting requires confirmation
  twitter_posts: "confirm",
};

/**
 * Returns the permission level for a tool.
 * Unknown tools (user-installed skills) default to "auto".
 */
export function getToolPermission(name: string): ToolPermission {
  return DEFAULT_PERMISSIONS[name] ?? "auto";
}
