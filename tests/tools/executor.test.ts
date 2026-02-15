import { describe, test, expect, beforeEach, afterEach } from "bun:test";
import { executeTool, type ToolResult } from "../../src/tools/executor";
import { registerTool, unregisterTool } from "../../src/tools/registry";

describe("executeTool", () => {
  test("returns an error result for an unknown tool", async () => {
    const result = await executeTool(
      "nonexistent_tool",
      "call-123",
      {}
    );

    expect(result.is_error).toBe(true);
    expect(result.tool_use_id).toBe("call-123");
    expect(result.content).toContain("Unknown tool");
    expect(result.content).toContain("nonexistent_tool");
  });

  test("blocks a tool not in the allowedTools list", async () => {
    const result = await executeTool(
      "some_tool",
      "call-456",
      {},
      ["other_tool"]
    );

    expect(result.is_error).toBe(true);
    expect(result.content).toContain("not available");
  });

  test("allows a tool that is in the allowedTools list", async () => {
    const testToolName = "__test_allowed_tool__";

    registerTool({
      definition: {
        name: testToolName,
        description: "A test tool",
        input_schema: { type: "object", properties: {} },
      },
      execute: async () => "success",
    });

    try {
      // Unknown tools default to "confirm" — first call returns confirmation token
      const confirmResult = await executeTool(
        testToolName,
        "call-789",
        {},
        [testToolName]
      );
      expect(confirmResult.content).toContain("Confirmation Token:");
      const tokenMatch = confirmResult.content.match(/Confirmation Token: ([a-f0-9-]+)/);
      expect(tokenMatch).toBeTruthy();

      // Second call with token executes the tool
      const result = await executeTool(
        testToolName,
        "call-789b",
        { _confirmToken: tokenMatch![1] },
        [testToolName]
      );
      expect(result.is_error).toBe(false);
      expect(result.content).toBe("success");
    } finally {
      unregisterTool(testToolName);
    }
  });

  test("returns a denied error for tools with deny permission", async () => {
    const result = await executeTool(
      "shell",
      "call-deny",
      {},
      [] // Empty allowedTools means nothing is allowed
    );

    expect(result.is_error).toBe(true);
    expect(result.content).toContain("not available");
  });

  test("executes a registered tool and returns its output", async () => {
    const testToolName = "__test_executor_tool__";

    registerTool({
      definition: {
        name: testToolName,
        description: "Echoes input back",
        input_schema: {
          type: "object",
          properties: { message: { type: "string" } },
        },
      },
      execute: async (input) => `echo: ${input.message}`,
    });

    try {
      // First call: get confirmation token (unknown tools default to "confirm")
      const confirmResult = await executeTool(testToolName, "call-exec", {
        message: "hello",
      });
      expect(confirmResult.content).toContain("Confirmation Token:");
      const tokenMatch = confirmResult.content.match(/Confirmation Token: ([a-f0-9-]+)/);
      expect(tokenMatch).toBeTruthy();

      // Second call with token: actually execute
      const result = await executeTool(testToolName, "call-exec2", {
        message: "hello",
        _confirmToken: tokenMatch![1],
      });

      expect(result.is_error).toBe(false);
      expect(result.content).toBe("echo: hello");
      expect(result.tool_use_id).toBe("call-exec2");
    } finally {
      unregisterTool(testToolName);
    }
  });

  test("returns an error result when a tool throws", async () => {
    const testToolName = "__test_throwing_tool__";

    registerTool({
      definition: {
        name: testToolName,
        description: "Always throws",
        input_schema: { type: "object", properties: {} },
      },
      execute: async () => {
        throw new Error("Something went wrong");
      },
    });

    try {
      // First call: get confirmation token
      const confirmResult = await executeTool(testToolName, "call-throw", {});
      const tokenMatch = confirmResult.content.match(/Confirmation Token: ([a-f0-9-]+)/);
      expect(tokenMatch).toBeTruthy();

      // Second call with token: tool throws
      const result = await executeTool(testToolName, "call-throw2", {
        _confirmToken: tokenMatch![1],
      });

      expect(result.is_error).toBe(true);
      expect(result.content).toContain("Something went wrong");
    } finally {
      unregisterTool(testToolName);
    }
  });
});
