import { join } from "path";
import { paths } from "../config/paths";
import { existsSync, appendFileSync, readFileSync } from "fs";
import type { LlmMessage } from "../llm/provider";

export interface SessionMessage {
  role: "user" | "assistant";
  content: any;
  timestamp: string;
}

function sessionPath(sessionId: string): string {
  return join(paths.sessions, `${sessionId}.jsonl`);
}

export function appendMessage(sessionId: string, message: SessionMessage) {
  const path = sessionPath(sessionId);
  appendFileSync(path, JSON.stringify(message) + "\n");
}

export function loadSession(
  sessionId: string,
  maxTurns: number = 50
): LlmMessage[] {
  const path = sessionPath(sessionId);
  if (!existsSync(path)) return [];

  const lines = readFileSync(path, "utf-8")
    .trim()
    .split("\n")
    .filter(Boolean);

  // Take last maxTurns messages
  const recent = lines.slice(-maxTurns);

  return recent.map((line) => {
    const msg: SessionMessage = JSON.parse(line);
    return { role: msg.role, content: msg.content };
  });
}

export function sessionExists(sessionId: string): boolean {
  return existsSync(sessionPath(sessionId));
}
