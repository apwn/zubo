import { describe, it, expect, beforeEach } from "bun:test";
import {
  registerTool,
  getTool,
  getAllToolDefs,
  unregisterTool,
} from "../src/tools/registry";

// Register a test tool before each test
const testTool = {
  definition: {
    name: "test_tool",
    description: "A tool for testing",
    input_schema: {
      type: "object",
      properties: {
        input: { type: "string" },
      },
      required: ["input"],
    },
  },
  execute: async (input: Record<string, unknown>) => {
    return `echo: ${input.input}`;
  },
};

describe("tool registry", () => {
  beforeEach(() => {
    unregisterTool("test_tool");
  });

  it("registers and retrieves a tool", () => {
    registerTool(testTool);
    const tool = getTool("test_tool");
    expect(tool).toBeDefined();
    expect(tool!.definition.name).toBe("test_tool");
  });

  it("returns undefined for unknown tool", () => {
    expect(getTool("nonexistent")).toBeUndefined();
  });

  it("unregisters a tool", () => {
    registerTool(testTool);
    expect(unregisterTool("test_tool")).toBe(true);
    expect(getTool("test_tool")).toBeUndefined();
  });

  it("returns false when unregistering unknown tool", () => {
    expect(unregisterTool("nonexistent")).toBe(false);
  });

  it("includes tool in getAllToolDefs", () => {
    registerTool(testTool);
    const defs = getAllToolDefs();
    const found = defs.find((d) => d.name === "test_tool");
    expect(found).toBeDefined();
    expect(found!.description).toBe("A tool for testing");
  });

  it("executes a tool handler", async () => {
    registerTool(testTool);
    const tool = getTool("test_tool")!;
    const result = await tool.execute({ input: "hello" });
    expect(result).toBe("echo: hello");
  });
});
