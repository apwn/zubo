import { describe, test, expect, beforeEach, afterAll } from "bun:test";
import { mock } from "bun:test";
import { writeFileSync, mkdtempSync, rmSync } from "fs";
import { join } from "path";
import { tmpdir } from "os";

/**
 * Tests for src/tools/mcp-registry.ts
 *
 * We mock `fetch` to avoid real network calls and mock the config paths +
 * MCP client modules. We do NOT mock `fs` — instead we use a real temp config file.
 */

// Create a temp directory for the config file
const testTmpDir = mkdtempSync(join(tmpdir(), "mcp-registry-test-"));
const testConfigPath = join(testTmpDir, "config.json");

// Track fetch calls for assertions
let fetchCalls: { url: string; options?: any }[] = [];
let fetchResponse: { ok: boolean; status: number; statusText: string; json: () => any } = {
  ok: true,
  status: 200,
  statusText: "OK",
  json: () => [],
};

// Track MCP client operations
let connectedServers: string[] = [];
let disconnectedServers: string[] = [];

// Override global fetch
const originalFetch = globalThis.fetch;
globalThis.fetch = async (input: any, init?: any) => {
  const url = typeof input === "string" ? input : input.url;
  fetchCalls.push({ url, options: init });
  return fetchResponse as any;
};

// Mock dependencies — but NOT `fs`!
mock.module("../src/util/logger", () => ({
  logger: {
    debug: () => {},
    info: () => {},
    warn: () => {},
    error: () => {},
  },
}));

mock.module("../src/config/paths", () => ({
  paths: {
    config: testConfigPath,
  },
}));

// NOTE: We intentionally do NOT mock.module("../src/tools/mcp-client") because
// Bun's mock.module is global and permanent — it would pollute mcp-client.test.ts
// causing McpClient to become undefined. Instead we use the __setMcpClientFns
// injection hook provided by mcp-registry.ts.

const {
  searchRegistry,
  getServerDetail,
  listRegistry,
  installFromRegistry,
  uninstallMcpServer,
  __setMcpClientFns,
} = await import("../src/tools/mcp-registry");

// Inject mock MCP client functions via dependency injection
__setMcpClientFns({
  connectMcpServer: async (config: any) => {
    connectedServers.push(config.name);
  },
  disconnectMcpServer: async (name: string) => {
    disconnectedServers.push(name);
  },
  getMcpStatus: () =>
    connectedServers.map((name) => ({ name, tools: 3, connected: true })),
});

afterAll(() => {
  globalThis.fetch = originalFetch;
  rmSync(testTmpDir, { recursive: true, force: true });
});

// Helper to write config file for install/uninstall tests
function writeTestConfig(data: any) {
  writeFileSync(testConfigPath, JSON.stringify(data, null, 2));
}

// ─── searchRegistry ─────────────────────────────────────────────────────────

describe("mcp-registry: searchRegistry", () => {
  beforeEach(() => {
    fetchCalls = [];
  });

  test("calls registry API with encoded query", async () => {
    const uniqueQuery = `test-search-${Date.now()}`;
    fetchResponse = {
      ok: true,
      status: 200,
      statusText: "OK",
      json: () => ({ servers: [{ name: "test-server", description: "A test server" }] }),
    };

    const results = await searchRegistry(uniqueQuery, 10);

    const call = fetchCalls.find((c) => c.url.includes(encodeURIComponent(uniqueQuery)));
    expect(call).toBeTruthy();
    expect(call!.url).toContain("limit=10");
    expect(results).toHaveLength(1);
    expect(results[0].name).toBe("test-server");
  });

  test("returns empty array on non-ok response", async () => {
    const uniqueQuery = `fail-search-${Date.now()}`;
    fetchResponse = {
      ok: false,
      status: 500,
      statusText: "Internal Server Error",
      json: () => ({}),
    };

    const results = await searchRegistry(uniqueQuery);
    expect(results).toEqual([]);
  });

  test("returns empty array on fetch error", async () => {
    const savedFetch = globalThis.fetch;
    globalThis.fetch = async () => {
      throw new Error("Network error");
    };

    const results = await searchRegistry(`error-search-${Date.now()}`);
    expect(results).toEqual([]);

    globalThis.fetch = savedFetch;
  });

  test("handles array response format", async () => {
    const uniqueQuery = `array-search-${Date.now()}`;
    fetchResponse = {
      ok: true,
      status: 200,
      statusText: "OK",
      json: () => [{ name: "server-a" }, { name: "server-b" }],
    };

    const results = await searchRegistry(uniqueQuery);
    expect(results).toHaveLength(2);
  });

  test("caches results for identical queries", async () => {
    const uniqueQuery = `cache-search-${Date.now()}`;
    fetchResponse = {
      ok: true,
      status: 200,
      statusText: "OK",
      json: () => [{ name: "cached-server" }],
    };

    const callsBefore = fetchCalls.length;
    await searchRegistry(uniqueQuery, 20);
    const callsAfterFirst = fetchCalls.length;

    // Second call with same query should use cache
    await searchRegistry(uniqueQuery, 20);
    const callsAfterSecond = fetchCalls.length;

    expect(callsAfterFirst).toBe(callsBefore + 1);
    expect(callsAfterSecond).toBe(callsAfterFirst); // No additional fetch call
  });
});

// ─── getServerDetail ────────────────────────────────────────────────────────

describe("mcp-registry: getServerDetail", () => {
  beforeEach(() => {
    fetchCalls = [];
  });

  test("fetches server detail by name", async () => {
    const uniqueName = `detail-server-${Date.now()}`;
    fetchResponse = {
      ok: true,
      status: 200,
      statusText: "OK",
      json: () => ({
        name: uniqueName,
        description: "A detailed server",
        command: "npx",
        args: [uniqueName],
      }),
    };

    const detail = await getServerDetail(uniqueName);

    expect(detail).not.toBeNull();
    expect(detail.name).toBe(uniqueName);
    expect(detail.command).toBe("npx");
  });

  test("returns null for non-ok response", async () => {
    const uniqueName = `missing-server-${Date.now()}`;
    fetchResponse = {
      ok: false,
      status: 404,
      statusText: "Not Found",
      json: () => ({}),
    };

    const detail = await getServerDetail(uniqueName);
    expect(detail).toBeNull();
  });

  test("caches server detail results", async () => {
    const uniqueName = `cached-detail-${Date.now()}`;
    fetchResponse = {
      ok: true,
      status: 200,
      statusText: "OK",
      json: () => ({ name: uniqueName }),
    };

    const callsBefore = fetchCalls.length;
    await getServerDetail(uniqueName);
    const callsAfterFirst = fetchCalls.length;

    await getServerDetail(uniqueName);
    const callsAfterSecond = fetchCalls.length;

    expect(callsAfterFirst).toBe(callsBefore + 1);
    expect(callsAfterSecond).toBe(callsAfterFirst);
  });
});

// ─── installFromRegistry ────────────────────────────────────────────────────

describe("mcp-registry: installFromRegistry", () => {
  beforeEach(() => {
    fetchCalls = [];
    connectedServers = [];
    writeTestConfig({ mcp: { servers: [] } });
  });

  test("installs a server from registry into config", async () => {
    const uniqueName = `install-server-${Date.now()}`;
    fetchResponse = {
      ok: true,
      status: 200,
      statusText: "OK",
      json: () => ({
        name: uniqueName,
        command: "npx",
        args: [uniqueName],
        env: { API_KEY: "test" },
      }),
    };

    const result = await installFromRegistry(uniqueName);

    expect(result.name).toBe(uniqueName);
    expect(result.tools).toBe(3); // from our mock getMcpStatus
    expect(connectedServers).toContain(uniqueName);

    // Verify config was written to disk
    const savedConfig = JSON.parse(require("fs").readFileSync(testConfigPath, "utf-8"));
    const server = savedConfig.mcp.servers.find((s: any) => s.name === uniqueName);
    expect(server).toBeTruthy();
    expect(server.command).toBe("npx");
    expect(server.enabled).toBe(true);
  });

  test("throws when server is not found in registry", async () => {
    const uniqueName = `missing-install-${Date.now()}`;
    fetchResponse = {
      ok: false,
      status: 404,
      statusText: "Not Found",
      json: () => ({}),
    };

    await expect(installFromRegistry(uniqueName)).rejects.toThrow("not found");
  });

  test("replaces existing server entry with same name", async () => {
    const uniqueName = `replace-server-${Date.now()}`;
    writeTestConfig({
      mcp: {
        servers: [{ name: uniqueName, command: "old-cmd", args: [], enabled: true }],
      },
    });

    fetchResponse = {
      ok: true,
      status: 200,
      statusText: "OK",
      json: () => ({
        name: uniqueName,
        command: "new-cmd",
        args: ["--new"],
      }),
    };

    await installFromRegistry(uniqueName);

    const savedConfig = JSON.parse(require("fs").readFileSync(testConfigPath, "utf-8"));
    const servers = savedConfig.mcp.servers.filter((s: any) => s.name === uniqueName);
    expect(servers).toHaveLength(1);
    expect(servers[0].command).toBe("new-cmd");
  });
});

// ─── uninstallMcpServer ─────────────────────────────────────────────────────

describe("mcp-registry: uninstallMcpServer", () => {
  beforeEach(() => {
    disconnectedServers = [];
  });

  test("disconnects and removes server from config", async () => {
    writeTestConfig({
      mcp: {
        servers: [
          { name: "keep-this", command: "cmd1" },
          { name: "remove-this", command: "cmd2" },
        ],
      },
    });

    await uninstallMcpServer("remove-this");

    expect(disconnectedServers).toContain("remove-this");

    const savedConfig = JSON.parse(require("fs").readFileSync(testConfigPath, "utf-8"));
    const remaining = savedConfig.mcp.servers.map((s: any) => s.name);
    expect(remaining).toContain("keep-this");
    expect(remaining).not.toContain("remove-this");
  });

  test("handles server not in config gracefully", async () => {
    writeTestConfig({ mcp: { servers: [] } });

    await expect(uninstallMcpServer("nonexistent")).resolves.toBeUndefined();
    expect(disconnectedServers).toContain("nonexistent");
  });
});
