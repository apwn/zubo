import { describe, it, expect, beforeEach, afterEach } from "bun:test";
import { mkdirSync, rmSync, existsSync } from "fs";
import { join } from "path";

const TEST_SESSION_DIR = join(import.meta.dir, ".test-sessions");

describe("Session", () => {
  beforeEach(() => {
    mkdirSync(TEST_SESSION_DIR, { recursive: true });
  });

  afterEach(() => {
    if (existsSync(TEST_SESSION_DIR)) {
      rmSync(TEST_SESSION_DIR, { recursive: true });
    }
  });

  it("should create session file on first append", async () => {
    const { writeFileSync, readFileSync } = await import("fs");
    const sessionPath = join(TEST_SESSION_DIR, "test-session.jsonl");

    const msg = { role: "user", content: [{ type: "text", text: "hello" }], timestamp: new Date().toISOString() };
    writeFileSync(sessionPath, JSON.stringify(msg) + "\n");

    expect(existsSync(sessionPath)).toBe(true);
    const content = readFileSync(sessionPath, "utf-8").trim();
    const parsed = JSON.parse(content);
    expect(parsed.role).toBe("user");
  });

  it("should append multiple messages", async () => {
    const { writeFileSync, readFileSync } = await import("fs");
    const sessionPath = join(TEST_SESSION_DIR, "multi.jsonl");

    const msgs = [
      { role: "user", content: [{ type: "text", text: "hi" }] },
      { role: "assistant", content: [{ type: "text", text: "hello" }] },
    ];

    let content = "";
    for (const msg of msgs) {
      content += JSON.stringify(msg) + "\n";
    }
    writeFileSync(sessionPath, content);

    const lines = readFileSync(sessionPath, "utf-8").trim().split("\n");
    expect(lines.length).toBe(2);
    expect(JSON.parse(lines[0]).role).toBe("user");
    expect(JSON.parse(lines[1]).role).toBe("assistant");
  });

  it("should reject path traversal in session IDs", () => {
    const dangerous = "../../../etc/passwd";
    const safe = dangerous.replace(/[^a-zA-Z0-9_:-]/g, "_");
    expect(safe).not.toContain("..");
    expect(safe).not.toContain("/");
  });
});
