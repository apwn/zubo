import { join } from "path";
import { paths } from "../config/paths";
import { existsSync, appendFileSync, readFileSync, statSync, openSync, readSync, closeSync } from "fs";
import type { LlmMessage } from "../llm/provider";

export interface SessionMessage {
  role: "user" | "assistant";
  content: any;
  timestamp: string;
}

function sessionPath(sessionId: string): string {
  // Validate session ID to prevent path traversal
  // Allow colons for channel:userId format, but block Windows path separators and ..
  if (!/^[a-zA-Z0-9:_+-]+$/.test(sessionId) || sessionId.includes("..")) {
    throw new Error("Invalid session ID");
  }
  const { resolve } = require("path");
  const result = join(paths.sessions, `${sessionId}.jsonl`);
  if (!resolve(result).startsWith(resolve(paths.sessions))) {
    throw new Error("Invalid session ID: path traversal detected");
  }
  return result;
}

export function appendMessage(sessionId: string, message: SessionMessage) {
  const path = sessionPath(sessionId);
  appendFileSync(path, JSON.stringify(message) + "\n");

  // Dual-write to conversation_messages DB for cross-channel history + FTS search
  try {
    const { recordMessage } = require("./history") as { recordMessage: (threadId: string, role: string, content: string, channel?: string) => void };
    const textContent = typeof message.content === "string"
      ? message.content
      : Array.isArray(message.content)
        ? message.content.filter((b: any) => b.type === "text").map((b: any) => b.text ?? "").join("\n")
        : JSON.stringify(message.content);
    // Parse channel from sessionId (format: "channel:userId" or bare id)
    const channel = sessionId.includes(":") ? sessionId.split(":")[0] : "webchat";
    recordMessage(sessionId, message.role, textContent, channel);
  } catch {
    // history module may not be available yet (e.g. before migrations run)
  }
}

/**
 * Read the last N lines from a file efficiently by reading from the end.
 * For small files (< 64KB), reads the whole file. For larger files,
 * reads backwards in chunks until enough lines are found.
 */
function readTailLines(filePath: string, count: number): string[] {
  const SMALL_FILE_THRESHOLD = 64 * 1024;
  const CHUNK_SIZE = 32 * 1024;

  const size = statSync(filePath).size;
  if (size === 0) return [];

  // Small file: just read the whole thing
  if (size <= SMALL_FILE_THRESHOLD) {
    return readFileSync(filePath, "utf-8").trim().split("\n").filter(Boolean).slice(-count);
  }

  // Large file: read from the end in chunks
  const fd = openSync(filePath, "r");
  try {
    let collected = "";
    let position = size;
    let lines: string[] = [];

    while (position > 0 && lines.length <= count) {
      const readSize = Math.min(CHUNK_SIZE, position);
      position -= readSize;
      const buf = Buffer.alloc(readSize);
      readSync(fd, buf, 0, readSize, position);
      collected = buf.toString("utf-8") + collected;
      lines = collected.split("\n").filter(Boolean);
    }

    return lines.slice(-count);
  } finally {
    closeSync(fd);
  }
}

export function loadSession(
  sessionId: string,
  maxTurns: number = 50
): LlmMessage[] {
  const path = sessionPath(sessionId);
  if (!existsSync(path)) return [];

  const recent = readTailLines(path, maxTurns);

  return recent.map((line) => {
    const msg: SessionMessage = JSON.parse(line);
    return { role: msg.role, content: msg.content };
  });
}

export function sessionExists(sessionId: string): boolean {
  return existsSync(sessionPath(sessionId));
}
