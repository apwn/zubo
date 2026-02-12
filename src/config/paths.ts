import { join } from "path";
import { homedir } from "os";

const ZUBO_HOME = join(homedir(), ".zubo");

export const paths = {
  root: ZUBO_HOME,
  config: join(ZUBO_HOME, "config.json"),
  db: join(ZUBO_HOME, "zubo.db"),
  workspace: join(ZUBO_HOME, "workspace"),
  memory: join(ZUBO_HOME, "workspace", "memory"),
  memoryFile: join(ZUBO_HOME, "workspace", "MEMORY.md"),
  systemPrompt: join(ZUBO_HOME, "workspace", "SYSTEM.md"),
  sessions: join(ZUBO_HOME, "sessions"),
  models: join(ZUBO_HOME, "models"),
  logs: join(ZUBO_HOME, "logs"),
  logFile: join(ZUBO_HOME, "logs", "zubo.log"),
  skills: join(ZUBO_HOME, "workspace", "skills"),
  agents: join(ZUBO_HOME, "workspace", "agents"),
  pidFile: join(ZUBO_HOME, "zubo.pid"),
};

export function ensureDirectories() {
  const dirs = [
    paths.root,
    paths.workspace,
    paths.memory,
    paths.sessions,
    paths.models,
    paths.logs,
    paths.skills,
    paths.agents,
  ];
  for (const dir of dirs) {
    Bun.spawnSync(["mkdir", "-p", dir]);
  }
}
