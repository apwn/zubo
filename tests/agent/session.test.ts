import { describe, test, expect, beforeEach, afterEach } from "bun:test";
import { mkdtempSync, rmSync } from "fs";
import { join } from "path";
import { tmpdir } from "os";

// Override paths.sessions before importing session module
import { paths } from "../../src/config/paths";

let tempDir: string;

// Patch the sessions path to a temp directory before each test
beforeEach(() => {
  tempDir = mkdtempSync(join(tmpdir(), "orba-session-test-"));
  (paths as any).sessions = tempDir;
});

afterEach(() => {
  rmSync(tempDir, { recursive: true, force: true });
});

// Import after paths is available (the module reads paths at call time, not import time)
import { appendMessage, loadSession, sessionExists } from "../../src/agent/session";
import type { SessionMessage } from "../../src/agent/session";

describe("session management", () => {
  test("appendMessage creates a session file and appends a message", () => {
    const msg: SessionMessage = {
      role: "user",
      content: "Hello",
      timestamp: new Date().toISOString(),
    };

    appendMessage("test-session", msg);
    expect(sessionExists("test-session")).toBe(true);
  });

  test("loadSession returns messages in order", () => {
    const messages: SessionMessage[] = [
      { role: "user", content: "First", timestamp: "2025-01-01T00:00:00Z" },
      { role: "assistant", content: "Second", timestamp: "2025-01-01T00:00:01Z" },
      { role: "user", content: "Third", timestamp: "2025-01-01T00:00:02Z" },
    ];

    for (const msg of messages) {
      appendMessage("ordered-session", msg);
    }

    const loaded = loadSession("ordered-session");
    expect(loaded).toHaveLength(3);
    expect(loaded[0].content).toBe("First");
    expect(loaded[1].content).toBe("Second");
    expect(loaded[2].content).toBe("Third");
  });

  test("loadSession respects the limit parameter", () => {
    for (let i = 0; i < 10; i++) {
      appendMessage("limited-session", {
        role: "user",
        content: `Message ${i}`,
        timestamp: new Date().toISOString(),
      });
    }

    const loaded = loadSession("limited-session", 3);
    expect(loaded).toHaveLength(3);
    // Should return the last 3 messages
    expect(loaded[0].content).toBe("Message 7");
    expect(loaded[1].content).toBe("Message 8");
    expect(loaded[2].content).toBe("Message 9");
  });

  test("loadSession returns empty array for nonexistent session", () => {
    const loaded = loadSession("does-not-exist");
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
    const msg: SessionMessage = {
      role: "user",
      content: "Hello from channel",
      timestamp: new Date().toISOString(),
    };

    appendMessage("discord:user123", msg);
    const loaded = loadSession("discord:user123");
    expect(loaded).toHaveLength(1);
    expect(loaded[0].content).toBe("Hello from channel");
  });
});
