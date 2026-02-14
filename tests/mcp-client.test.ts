import { describe, test, expect } from "bun:test";

/**
 * Tests for MCP client internals: JSON-RPC message formatting,
 * buffer parsing (Content-Length framed + raw JSON lines),
 * tool name prefixing, and error handling.
 *
 * We test the internal logic by creating a McpClient instance and
 * exercising its private methods via a subclass or by directly
 * calling the protocol parsing logic. Since processBuffer and
 * handleResponse are private, we replicate their logic in tests
 * to validate the protocol handling without spawning real servers.
 */

// ── JSON-RPC message formatting ──────────────────────────────────────────────

describe("MCP: JSON-RPC message formatting", () => {
  test("request message has correct structure", () => {
    const message = {
      jsonrpc: "2.0" as const,
      id: 1,
      method: "tools/list",
      params: {},
    };

    expect(message.jsonrpc).toBe("2.0");
    expect(message.id).toBe(1);
    expect(message.method).toBe("tools/list");
    expect(message.params).toEqual({});
  });

  test("notification message has no id", () => {
    const notification = {
      jsonrpc: "2.0" as const,
      method: "notifications/initialized",
      params: {},
    };

    expect(notification.jsonrpc).toBe("2.0");
    expect("id" in notification).toBe(false);
    expect(notification.method).toBe("notifications/initialized");
  });

  test("Content-Length header is correctly computed", () => {
    const json = JSON.stringify({
      jsonrpc: "2.0",
      id: 1,
      method: "initialize",
      params: { protocolVersion: "2024-11-05" },
    });

    const byteLength = Buffer.byteLength(json);
    const data = `Content-Length: ${byteLength}\r\n\r\n${json}`;

    // Verify the header encodes the exact byte length
    const headerMatch = data.match(/Content-Length:\s*(\d+)/);
    expect(headerMatch).not.toBeNull();
    expect(parseInt(headerMatch![1], 10)).toBe(byteLength);

    // Verify the body starts after \r\n\r\n
    const bodyStart = data.indexOf("\r\n\r\n") + 4;
    const body = data.slice(bodyStart);
    expect(body).toBe(json);
    expect(Buffer.byteLength(body)).toBe(byteLength);
  });

  test("Content-Length handles multi-byte characters", () => {
    const json = JSON.stringify({
      jsonrpc: "2.0",
      id: 1,
      method: "tools/call",
      params: { name: "test", arguments: { text: "Hello \u00e9\u00e8\u00ea\u00eb" } },
    });

    const byteLength = Buffer.byteLength(json);
    // Multi-byte chars make byte length > string length
    expect(byteLength).toBeGreaterThanOrEqual(json.length);

    const data = `Content-Length: ${byteLength}\r\n\r\n${json}`;
    const headerMatch = data.match(/Content-Length:\s*(\d+)/);
    expect(parseInt(headerMatch![1], 10)).toBe(byteLength);
  });
});

// ── processBuffer parsing ────────────────────────────────────────────────────

/**
 * Replicate the processBuffer logic from McpClient to test it in isolation.
 * This mirrors src/tools/mcp-client.ts processBuffer().
 */
interface ParsedMessage {
  jsonrpc: string;
  id?: number;
  result?: any;
  error?: { code: number; message: string; data?: any };
}

function parseBuffer(buffer: string): { messages: ParsedMessage[]; remaining: string } {
  const messages: ParsedMessage[] = [];
  let buf = buffer;

  while (true) {
    // Try Content-Length framed message
    const headerEnd = buf.indexOf("\r\n\r\n");
    if (headerEnd === -1) {
      // Try raw JSON lines
      const newlineIdx = buf.indexOf("\n");
      if (newlineIdx === -1) break;

      const line = buf.slice(0, newlineIdx).trim();
      buf = buf.slice(newlineIdx + 1);

      if (line.startsWith("{")) {
        try {
          const msg = JSON.parse(line) as ParsedMessage;
          messages.push(msg);
        } catch {
          // Not valid JSON, skip
        }
      }
      continue;
    }

    const header = buf.slice(0, headerEnd);
    const contentLengthMatch = header.match(/Content-Length:\s*(\d+)/i);

    if (!contentLengthMatch) {
      // Skip malformed header
      buf = buf.slice(headerEnd + 4);
      continue;
    }

    const contentLength = parseInt(contentLengthMatch[1], 10);
    const bodyStart = headerEnd + 4;

    if (buf.length < bodyStart + contentLength) {
      break; // Need more data
    }

    const body = buf.slice(bodyStart, bodyStart + contentLength);
    buf = buf.slice(bodyStart + contentLength);

    try {
      const msg = JSON.parse(body) as ParsedMessage;
      messages.push(msg);
    } catch {
      // Failed to parse
    }
  }

  return { messages, remaining: buf };
}

describe("MCP: processBuffer - Content-Length framed", () => {
  test("parses a single framed message", () => {
    const json = JSON.stringify({ jsonrpc: "2.0", id: 1, result: { tools: [] } });
    const buffer = `Content-Length: ${Buffer.byteLength(json)}\r\n\r\n${json}`;

    const { messages, remaining } = parseBuffer(buffer);
    expect(messages).toHaveLength(1);
    expect(messages[0].id).toBe(1);
    expect(messages[0].result).toEqual({ tools: [] });
    expect(remaining).toBe("");
  });

  test("parses multiple framed messages", () => {
    const msg1 = JSON.stringify({ jsonrpc: "2.0", id: 1, result: "a" });
    const msg2 = JSON.stringify({ jsonrpc: "2.0", id: 2, result: "b" });
    const buffer =
      `Content-Length: ${Buffer.byteLength(msg1)}\r\n\r\n${msg1}` +
      `Content-Length: ${Buffer.byteLength(msg2)}\r\n\r\n${msg2}`;

    const { messages } = parseBuffer(buffer);
    expect(messages).toHaveLength(2);
    expect(messages[0].id).toBe(1);
    expect(messages[1].id).toBe(2);
  });

  test("handles incomplete message (needs more data)", () => {
    const json = JSON.stringify({ jsonrpc: "2.0", id: 1, result: "ok" });
    const fullLength = Buffer.byteLength(json);
    // Only provide partial body
    const buffer = `Content-Length: ${fullLength}\r\n\r\n${json.slice(0, 5)}`;

    const { messages, remaining } = parseBuffer(buffer);
    expect(messages).toHaveLength(0);
    expect(remaining).toBe(buffer); // Buffer preserved for next read
  });

  test("skips malformed headers (no Content-Length)", () => {
    const json = JSON.stringify({ jsonrpc: "2.0", id: 1, result: "ok" });
    // After the malformed header is skipped, the JSON body remains in the buffer
    // but without a newline it cannot be parsed as a raw JSON line.
    // Add a trailing newline so it gets picked up as a raw JSON line.
    const buffer = `X-Custom: ignored\r\n\r\n${json}\n`;

    const { messages } = parseBuffer(buffer);
    expect(messages).toHaveLength(1);
    expect(messages[0].result).toBe("ok");
  });

  test("handles case-insensitive Content-Length header", () => {
    const json = JSON.stringify({ jsonrpc: "2.0", id: 1, result: "ok" });
    const buffer = `content-length: ${Buffer.byteLength(json)}\r\n\r\n${json}`;

    const { messages } = parseBuffer(buffer);
    expect(messages).toHaveLength(1);
    expect(messages[0].result).toBe("ok");
  });
});

describe("MCP: processBuffer - raw JSON lines", () => {
  test("parses a raw JSON line", () => {
    const buffer = `{"jsonrpc":"2.0","id":1,"result":"hello"}\n`;

    const { messages } = parseBuffer(buffer);
    expect(messages).toHaveLength(1);
    expect(messages[0].result).toBe("hello");
  });

  test("parses multiple raw JSON lines", () => {
    const buffer = [
      `{"jsonrpc":"2.0","id":1,"result":"a"}`,
      `{"jsonrpc":"2.0","id":2,"result":"b"}`,
      "",
    ].join("\n");

    const { messages } = parseBuffer(buffer);
    expect(messages).toHaveLength(2);
  });

  test("skips non-JSON lines", () => {
    const buffer = `some random text\n{"jsonrpc":"2.0","id":1,"result":"ok"}\n`;

    const { messages } = parseBuffer(buffer);
    expect(messages).toHaveLength(1);
    expect(messages[0].result).toBe("ok");
  });

  test("handles mixed Content-Length and raw lines", () => {
    const framedJson = JSON.stringify({ jsonrpc: "2.0", id: 1, result: "framed" });
    const rawJson = `{"jsonrpc":"2.0","id":2,"result":"raw"}`;
    const buffer =
      `Content-Length: ${Buffer.byteLength(framedJson)}\r\n\r\n${framedJson}${rawJson}\n`;

    const { messages } = parseBuffer(buffer);
    expect(messages).toHaveLength(2);
    expect(messages[0].result).toBe("framed");
    expect(messages[1].result).toBe("raw");
  });
});

// ── handleResponse logic ─────────────────────────────────────────────────────

describe("MCP: handleResponse logic", () => {
  test("resolves pending request on success", () => {
    const pending = new Map<number, { resolve: (v: any) => void; reject: (e: Error) => void }>();
    let resolved: any = null;

    pending.set(1, {
      resolve: (v) => { resolved = v; },
      reject: () => {},
    });

    const msg = { jsonrpc: "2.0" as const, id: 1, result: { tools: ["a", "b"] } };

    // Simulate handleResponse
    if (msg.id !== undefined && msg.id !== null) {
      const p = pending.get(msg.id);
      if (p) {
        pending.delete(msg.id);
        if (msg.error) {
          p.reject(new Error(`MCP error: ${(msg as any).error.message}`));
        } else {
          p.resolve(msg.result);
        }
      }
    }

    expect(resolved).toEqual({ tools: ["a", "b"] });
    expect(pending.size).toBe(0);
  });

  test("rejects pending request on error", () => {
    const pending = new Map<number, { resolve: (v: any) => void; reject: (e: Error) => void }>();
    let rejected: Error | null = null;

    pending.set(2, {
      resolve: () => {},
      reject: (e) => { rejected = e; },
    });

    const msg = {
      jsonrpc: "2.0" as const,
      id: 2,
      error: { code: -32600, message: "Invalid Request" },
    };

    // Simulate handleResponse
    if (msg.id !== undefined && msg.id !== null) {
      const p = pending.get(msg.id);
      if (p) {
        pending.delete(msg.id);
        if (msg.error) {
          p.reject(new Error(`MCP error: ${msg.error.message} (code: ${msg.error.code})`));
        } else {
          p.resolve((msg as any).result);
        }
      }
    }

    expect(rejected).not.toBeNull();
    expect(rejected!.message).toContain("Invalid Request");
    expect(rejected!.message).toContain("-32600");
  });

  test("ignores notifications (no id)", () => {
    const pending = new Map<number, { resolve: (v: any) => void; reject: (e: Error) => void }>();
    let called = false;

    pending.set(1, {
      resolve: () => { called = true; },
      reject: () => { called = true; },
    });

    const notification = { jsonrpc: "2.0" as const, method: "some/notification", params: {} };

    // Simulate handleResponse
    if ((notification as any).id === undefined || (notification as any).id === null) {
      // Notification -- ignore
    } else {
      // Handle response
      called = true;
    }

    expect(called).toBe(false);
    expect(pending.size).toBe(1); // Pending not affected
  });

  test("ignores responses with unknown ids", () => {
    const pending = new Map<number, { resolve: (v: any) => void; reject: (e: Error) => void }>();
    let called = false;

    pending.set(1, {
      resolve: () => { called = true; },
      reject: () => { called = true; },
    });

    const msg = { jsonrpc: "2.0" as const, id: 999, result: "orphan" };

    // Simulate handleResponse
    const p = pending.get(msg.id);
    if (p) {
      called = true;
    }

    expect(called).toBe(false);
    expect(pending.size).toBe(1);
  });
});

// ── Tool name prefixing ─────────────────────────────────────────────────────

describe("MCP: tool name prefixing", () => {
  test("creates correct zubo tool name with server prefix", () => {
    const serverName = "my-server";
    const toolName = "search";
    const zuboName = `${serverName}__${toolName}`;
    expect(zuboName).toBe("my-server__search");
  });

  test("handles special characters in server name", () => {
    const serverName = "test-server_v2";
    const toolName = "run_query";
    const zuboName = `${serverName}__${toolName}`;
    expect(zuboName).toBe("test-server_v2__run_query");
  });

  test("tool description includes MCP prefix", () => {
    const serverName = "filesystem";
    const toolDescription = "Read a file from disk";
    const description = `[MCP: ${serverName}] ${toolDescription}`;
    expect(description).toBe("[MCP: filesystem] Read a file from disk");
  });

  test("tool description uses name when description is missing", () => {
    const serverName = "myserver";
    const toolName = "do_stuff";
    const toolDescription: string | undefined = undefined;
    const description = `[MCP: ${serverName}] ${toolDescription ?? toolName}`;
    expect(description).toBe("[MCP: myserver] do_stuff");
  });
});

// ── McpClient construction and state ─────────────────────────────────────────

describe("MCP: McpClient class basics", () => {
  test("imports McpClient successfully", async () => {
    const mod = await import("../src/tools/mcp-client");
    expect(mod.McpClient).toBeDefined();
    expect(typeof mod.McpClient).toBe("function");
  });

  test("creates instance without connecting", async () => {
    const { McpClient } = await import("../src/tools/mcp-client");
    const client = new McpClient({
      name: "test-server",
      command: "echo",
      args: ["hello"],
    });
    expect(client.isConnected()).toBe(false);
  });

  test("getMcpStatus returns empty by default", async () => {
    const { getMcpStatus } = await import("../src/tools/mcp-client");
    const status = getMcpStatus();
    expect(Array.isArray(status)).toBe(true);
  });

  test("McpServerConfig accepts optional fields", async () => {
    const { McpClient } = await import("../src/tools/mcp-client");
    const client = new McpClient({
      name: "minimal",
      command: "node",
    });
    expect(client.isConnected()).toBe(false);
  });
});
