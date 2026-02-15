import { describe, it, expect, beforeEach, afterEach } from "bun:test";
import { registerTool, unregisterTool } from "../src/tools/registry";
import { executeTool } from "../src/tools/executor";

describe("Tool Executor", () => {
  beforeEach(() => {
    // Register a test tool
    registerTool({
      definition: {
        name: "test_tool",
        description: "A test tool",
        input_schema: { type: "object", properties: { msg: { type: "string" } } },
      },
      async execute(input) {
        return `echo: ${input.msg}`;
      },
    });
  });

  afterEach(() => {
    unregisterTool("test_tool");
    unregisterTool("error_tool");
  });

  it("should execute a registered tool (with confirmation)", async () => {
    // Unknown tools default to "confirm" — first call returns confirmation token
    const confirmResult = await executeTool("test_tool", "t1", { msg: "hello" });
    expect(confirmResult.content).toContain("Confirmation Token:");
    const tokenMatch = confirmResult.content.match(/Confirmation Token: ([a-f0-9-]+)/);
    expect(tokenMatch).toBeTruthy();

    // Second call with token executes the tool
    const result = await executeTool("test_tool", "t1b", { msg: "hello", _confirmToken: tokenMatch![1] });
    expect(result.content).toBe("echo: hello");
    expect(result.is_error).toBe(false);
    expect(result.tool_use_id).toBe("t1b");
  });

  it("should return error for unknown tool", async () => {
    const result = await executeTool("nonexistent_tool", "t2", {});
    expect(result.is_error).toBe(true);
    expect(result.content).toContain("Unknown tool");
  });

  it("should block tools not in allowedTools", async () => {
    const result = await executeTool("test_tool", "t3", { msg: "hi" }, ["other_tool"]);
    expect(result.is_error).toBe(true);
    expect(result.content).toContain("not available");
  });

  it("should handle tool execution errors", async () => {
    registerTool({
      definition: {
        name: "error_tool",
        description: "Always fails",
        input_schema: { type: "object" },
      },
      async execute() {
        throw new Error("intentional failure");
      },
    });

    // Unknown tools default to "confirm" — first call returns confirmation token
    const confirmResult = await executeTool("error_tool", "t4", {});
    expect(confirmResult.content).toContain("Confirmation Token:");
    const tokenMatch = confirmResult.content.match(/Confirmation Token: ([a-f0-9-]+)/);
    expect(tokenMatch).toBeTruthy();

    // Second call with token — tool throws
    const result = await executeTool("error_tool", "t4b", { _confirmToken: tokenMatch![1] });
    expect(result.is_error).toBe(true);
    expect(result.content).toContain("intentional failure");
  });

  it("should require confirmation for confirm-permission tools", async () => {
    // Register the shell tool so executeTool can find it
    registerTool({
      definition: {
        name: "shell",
        description: "Run shell commands",
        input_schema: { type: "object", properties: { command: { type: "string" } } },
      },
      async execute(input) {
        return `ran: ${input.command}`;
      },
    });

    const result = await executeTool("shell", "t5", { command: "ls" });
    // shell has "confirm" permission, so it should request confirmation
    expect(result.content).toContain("CONFIRMATION REQUIRED");
    expect(result.content).toContain("Confirmation Token:");

    unregisterTool("shell");
  });

  it("should accept valid confirmation token", async () => {
    registerTool({
      definition: {
        name: "shell",
        description: "Run shell commands",
        input_schema: { type: "object", properties: { command: { type: "string" } } },
      },
      async execute(input) {
        return `ran: ${input.command}`;
      },
    });

    // First call gets the token
    const first = await executeTool("shell", "t6", { command: "ls" });
    expect(first.content).toContain("Confirmation Token:");
    const tokenMatch = first.content.match(/Confirmation Token: ([a-f0-9-]+)/);
    expect(tokenMatch).toBeTruthy();

    // Second call with valid token should execute
    const second = await executeTool("shell", "t7", { command: "ls", _confirmToken: tokenMatch![1] });
    expect(second.is_error).toBe(false);
    expect(second.content).toBe("ran: ls");

    unregisterTool("shell");
  });

  it("should reject spoofed _confirmed without token", async () => {
    registerTool({
      definition: {
        name: "shell",
        description: "Run shell commands",
        input_schema: { type: "object", properties: { command: { type: "string" } } },
      },
      async execute(input) {
        return `ran: ${input.command}`;
      },
    });

    // Try to bypass with _confirmed: true — should still require token
    const result = await executeTool("shell", "t8", { command: "rm -rf /", _confirmed: true });
    expect(result.content).toContain("CONFIRMATION REQUIRED");

    unregisterTool("shell");
  });

  it("should reject invalid confirmation token", async () => {
    registerTool({
      definition: {
        name: "shell",
        description: "Run shell commands",
        input_schema: { type: "object", properties: { command: { type: "string" } } },
      },
      async execute(input) {
        return `ran: ${input.command}`;
      },
    });

    const result = await executeTool("shell", "t9", { command: "ls", _confirmToken: "fake-token-12345" });
    expect(result.content).toContain("Invalid or expired confirmation token");

    unregisterTool("shell");
  });
});
