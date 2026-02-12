import { join } from "path";
import { homedir } from "os";

const ORBA_HOME = join(homedir(), ".orba");

export const paths = {
  root: ORBA_HOME,
  config: join(ORBA_HOME, "config.json"),
  db: join(ORBA_HOME, "orba.db"),
  workspace: join(ORBA_HOME, "workspace"),
  memory: join(ORBA_HOME, "workspace", "memory"),
  memoryFile: join(ORBA_HOME, "workspace", "MEMORY.md"),
  systemPrompt: join(ORBA_HOME, "workspace", "SYSTEM.md"),
  sessions: join(ORBA_HOME, "sessions"),
  models: join(ORBA_HOME, "models"),
  logs: join(ORBA_HOME, "logs"),
  logFile: join(ORBA_HOME, "logs", "orba.log"),
  pidFile: join(ORBA_HOME, "orba.pid"),
};

export function ensureDirectories() {
  const dirs = [
    paths.root,
    paths.workspace,
    paths.memory,
    paths.sessions,
    paths.models,
    paths.logs,
  ];
  for (const dir of dirs) {
    Bun.spawnSync(["mkdir", "-p", dir]);
  }
}
