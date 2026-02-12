import { appendFileSync, existsSync, mkdirSync } from "fs";
import { dirname } from "path";
import { paths } from "../config/paths";

type LogLevel = "debug" | "info" | "warn" | "error";

const LEVELS: Record<LogLevel, number> = {
  debug: 0,
  info: 1,
  warn: 2,
  error: 3,
};

let currentLevel: LogLevel = "info";
let fileLogging = false;

export function setLogLevel(level: LogLevel) {
  currentLevel = level;
}

export function enableFileLogging() {
  const dir = dirname(paths.logFile);
  if (!existsSync(dir)) mkdirSync(dir, { recursive: true });
  fileLogging = true;
}

const SENSITIVE_KEYS = ["value", "secret", "password", "token", "key", "credential", "apikey", "api_key", "input"];

function sanitizeLogData(data: Record<string, unknown>): Record<string, unknown> {
  const sanitized: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(data)) {
    const lower = k.toLowerCase();
    if (SENSITIVE_KEYS.some((s) => lower.includes(s)) && typeof v === "string" && v.length > 20) {
      sanitized[k] = v.slice(0, 8) + "…[REDACTED]";
    } else if (typeof v === "object" && v !== null && !Array.isArray(v)) {
      sanitized[k] = sanitizeLogData(v as Record<string, unknown>);
    } else {
      sanitized[k] = v;
    }
  }
  return sanitized;
}

function log(level: LogLevel, msg: string, data?: Record<string, unknown>) {
  if (LEVELS[level] < LEVELS[currentLevel]) return;
  const ts = new Date().toISOString();
  const prefix = `[${ts}] [${level.toUpperCase()}]`;
  const safeData = data ? sanitizeLogData(data) : undefined;
  const line = safeData
    ? `${prefix} ${msg} ${JSON.stringify(safeData)}`
    : `${prefix} ${msg}`;

  console.log(line);

  if (fileLogging) {
    try {
      appendFileSync(paths.logFile, line + "\n");
    } catch {
      // don't crash if log write fails
    }
  }
}

export const logger = {
  debug: (msg: string, data?: Record<string, unknown>) =>
    log("debug", msg, data),
  info: (msg: string, data?: Record<string, unknown>) =>
    log("info", msg, data),
  warn: (msg: string, data?: Record<string, unknown>) =>
    log("warn", msg, data),
  error: (msg: string, data?: Record<string, unknown>) =>
    log("error", msg, data),
};
