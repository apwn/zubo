import { describe, test, expect, beforeEach, afterEach } from "bun:test";
import { mkdirSync, writeFileSync, existsSync, unlinkSync, mkdtempSync, rmSync } from "fs";
import { join } from "path";
import { paths } from "../src/config/paths";
import { getTool, unregisterTool } from "../src/tools/registry";
import { registerEmailSendTool } from "../src/tools/builtin/email-send";

const TMP_ATTACHMENT = "/tmp/zubo-email-test-attachment.txt";
const ORIGINAL_CONFIG_PATH = paths.config;

let testConfigDir = "";

function writeTestConfig(config: Record<string, unknown>) {
  mkdirSync(testConfigDir, { recursive: true });
  writeFileSync(paths.config, JSON.stringify(config));
}

describe("email_send tool", () => {
  beforeEach(() => {
    testConfigDir = mkdtempSync(join(process.cwd(), ".tmp-email-send-test-"));
    paths.config = join(testConfigDir, "config.json");
    registerEmailSendTool();
    writeTestConfig({
      channels: {
        email: {
          enabled: true,
          imap: { host: "imap.example.com", port: 993, user: "u", password: "p", tls: true },
          smtp: { host: "smtp.example.com", port: 587, user: "u", password: "p", tls: true },
          pollIntervalSeconds: 60,
        },
      },
    });
  });

  afterEach(() => {
    unregisterTool("email_send");
    paths.config = ORIGINAL_CONFIG_PATH;
    if (testConfigDir) rmSync(testConfigDir, { recursive: true, force: true });
    try {
      if (existsSync(TMP_ATTACHMENT)) unlinkSync(TMP_ATTACHMENT);
    } catch {}
  });

  test("rejects attachment paths outside workspace/uploads roots", async () => {
    writeFileSync(TMP_ATTACHMENT, "hello");
    const tool = getTool("email_send");
    expect(tool).toBeDefined();
    const result = await tool!.execute({
      to: "a@example.com",
      subject: "test",
      body: "body",
      attachments: [TMP_ATTACHMENT],
    });
    expect(result).toContain("outside allowed roots");
  });

  test("rejects invalid upload attachment references", async () => {
    const tool = getTool("email_send");
    expect(tool).toBeDefined();
    const result = await tool!.execute({
      to: "a@example.com",
      subject: "test",
      body: "body",
      attachments: ["upload:not-a-number"],
    });
    expect(result).toContain("Invalid attachment reference");
  });
});
