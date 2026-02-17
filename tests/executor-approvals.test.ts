import { describe, test, expect, beforeEach, afterEach } from "bun:test";
import { registerTool, unregisterTool } from "../src/tools/registry";
import { executeTool } from "../src/tools/executor";
import { mkdirSync, writeFileSync, mkdtempSync, rmSync } from "fs";
import { join } from "path";
import { paths } from "../src/config/paths";

const ORIGINAL_CONFIG_PATH = paths.config;
let testConfigDir = "";

function writeTestConfig(config: Record<string, unknown>) {
  mkdirSync(testConfigDir, { recursive: true });
  writeFileSync(paths.config, JSON.stringify(config));
}

describe("Tool Executor approvals.autoApproveFirstPartyTools", () => {
  beforeEach(() => {
    testConfigDir = mkdtempSync(join(process.cwd(), ".tmp-executor-approvals-test-"));
    paths.config = join(testConfigDir, "config.json");
    registerTool({
      definition: {
        name: "webhook_manage",
        description: "test confirm-gated first-party tool",
        input_schema: { type: "object", properties: {} },
      },
      async execute() {
        return "ok";
      },
    });
  });

  afterEach(() => {
    unregisterTool("webhook_manage");
    paths.config = ORIGINAL_CONFIG_PATH;
    if (testConfigDir) rmSync(testConfigDir, { recursive: true, force: true });
  });

  test("auto-approves first-party confirm tools when enabled", async () => {
    writeTestConfig({ approvals: { autoApproveFirstPartyTools: true } });
    const result = await executeTool("webhook_manage", "t1", {});
    expect(result.is_error).toBe(false);
    expect(result.content).toBe("ok");
  });

  test("requires confirmation when disabled", async () => {
    writeTestConfig({ approvals: { autoApproveFirstPartyTools: false } });
    const result = await executeTool("webhook_manage", "t2", {});
    expect(result.is_error).toBe(false);
    expect(result.content).toContain("CONFIRMATION REQUIRED");
  });
});
