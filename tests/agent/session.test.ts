import { describe, test, expect, beforeAll, afterAll } from "bun:test";
import { mkdtempSync, rmSync, writeFileSync, appendFileSync } from "fs";
import { join } from "path";
import { tmpdir } from "os";
import { randomBytes } from "crypto";

import { paths } from "../../src/config/paths";
import { appendMessage, loadSession, sessionExists } from "../../src/agent/session";
import type { SessionMessage } from "../../src/agent/session";

describe("session management", () => {
  let tempDir: string;
  let originalSessionsPath: string;
  const uid = randomBytes(4).toString("hex");

  beforeAll(() => {
    tempDir = mkdtempSync(join(tmpdir(), "orba-session-test-"));
    originalSessionsPath = (paths as any).sessions;
    (paths as any).sessions = tempDir;
  });

  afterAll(() => {
    (paths as any).sessions = originalSessionsPath;
    rmSync(tempDir, { recursive: true, force: true });
  });

  test("appendMessage creates a session file and appends a message", () => {
    const msg: SessionMessage = {
      role: "user",
      content: "Hello",
      timestamp: new Date().toISOString(),
    };

    appendMessage(`test-session-${uid}`, msg);
    expect(sessionExists(`test-session-${uid}`)).toBe(true);
  });

  test("loadSession returns messages in order", () => {
    const id = `ordered-${uid}`;
    const sessionFile = join(tempDir, `${id}.jsonl`);

    const content = [
      JSON.stringify({ role: "user", content: "First", timestamp: "2025-01-01T00:00:00Z" }),
      JSON.stringify({ role: "assistant", content: "Second", timestamp: "2025-01-01T00:00:01Z" }),
      JSON.stringify({ role: "user", content: "Third", timestamp: "2025-01-01T00:00:02Z" }),
    ].join("\n") + "\n";
    writeFileSync(sessionFile, content);

    const loaded = loadSession(id);
    expect(loaded).toHaveLength(3);
    expect(loaded[0].content).toBe("First");
    expect(loaded[1].content).toBe("Second");
    expect(loaded[2].content).toBe("Third");
  });

  test("loadSession respects the limit parameter", () => {
    const id = `limited-${uid}`;
    const sessionFile = join(tempDir, `${id}.jsonl`);

    const lines = Array.from({ length: 10 }, (_, i) =>
      JSON.stringify({ role: "user", content: `Message ${i}`, timestamp: new Date().toISOString() })
    ).join("\n") + "\n";
    writeFileSync(sessionFile, lines);

    const loaded = loadSession(id, 3);
    expect(loaded).toHaveLength(3);
    expect(loaded[0].content).toBe("Message 7");
    expect(loaded[1].content).toBe("Message 8");
    expect(loaded[2].content).toBe("Message 9");
  });

  test("loadSession returns empty array for nonexistent session", () => {
    const loaded = loadSession(`nonexistent-${uid}`);
    expect(loaded).toEqual([]);
  });

  test("session ID validation rejects path traversal attempts", () => {
    expect(() => {
      appendMessage("../../etc/passwd", {
        role: "user",
        content: "malicious",
        timestamp: new Date().toISOString(),
      });
    }).toThrow("Invalid session ID");
  });

  test("session ID validation rejects slashes", () => {
    expect(() => {
      appendMessage("foo/bar", {
        role: "user",
        content: "malicious",
        timestamp: new Date().toISOString(),
      });
    }).toThrow("Invalid session ID");
  });

  test("session ID allows colons for channel:userId format", () => {
    const id = `discord:user-${uid}`;
    const sessionFile = join(tempDir, `${id}.jsonl`);
    const msg = { role: "user", content: "Hello from channel", timestamp: new Date().toISOString() };
    writeFileSync(sessionFile, JSON.stringify(msg) + "\n");

    const loaded = loadSession(id);
    expect(loaded).toHaveLength(1);
    expect(loaded[0].content).toBe("Hello from channel");
  });
});
