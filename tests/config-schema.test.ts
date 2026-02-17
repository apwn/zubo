import { describe, test, expect } from "bun:test";
import { configSchema } from "../src/config/schema";

// ── Basic validation ─────────────────────────────────────────────────────────

describe("Config Schema: basic validation", () => {
  test("validates minimal config with anthropicApiKey", () => {
    const result = configSchema.safeParse({
      anthropicApiKey: "test-key",
    });
    expect(result.success).toBe(true);
  });

  test("validates empty config (all fields are optional)", () => {
    const result = configSchema.safeParse({});
    expect(result.success).toBe(true);
  });

  test("provides correct defaults", () => {
    const result = configSchema.parse({});
    expect(result.maxTurns).toBe(50);
    expect(result.heartbeatMinutes).toBe(30);
    expect(result.telegramAllowedUsers).toEqual([]);
  });

  test("rejects heartbeatMinutes below 1", () => {
    const result = configSchema.safeParse({
      heartbeatMinutes: 0,
    });
    expect(result.success).toBe(false);
  });

  test("rejects heartbeatMinutes above 1440", () => {
    const result = configSchema.safeParse({
      heartbeatMinutes: 1441,
    });
    expect(result.success).toBe(false);
  });

  test("accepts heartbeatMinutes at boundaries", () => {
    expect(configSchema.safeParse({ heartbeatMinutes: 1 }).success).toBe(true);
    expect(configSchema.safeParse({ heartbeatMinutes: 1440 }).success).toBe(true);
  });
});

// ── MCP config ───────────────────────────────────────────────────────────────

describe("Config Schema: mcp", () => {
  test("validates MCP server configuration", () => {
    const result = configSchema.safeParse({
      mcp: {
        servers: [
          {
            name: "filesystem",
            command: "npx",
            args: ["-y", "@modelcontextprotocol/server-filesystem"],
            env: { HOME: "/tmp" },
            enabled: true,
          },
        ],
      },
    });
    expect(result.success).toBe(true);
  });

  test("validates MCP with minimal server config", () => {
    const result = configSchema.safeParse({
      mcp: {
        servers: [
          { name: "test", command: "echo" },
        ],
      },
    });
    expect(result.success).toBe(true);
  });

  test("defaults enabled to true in MCP server", () => {
    const result = configSchema.parse({
      mcp: {
        servers: [{ name: "test", command: "echo" }],
      },
    });
    expect(result.mcp!.servers[0].enabled).toBe(true);
  });

  test("rejects MCP server with empty name", () => {
    const result = configSchema.safeParse({
      mcp: {
        servers: [{ name: "", command: "echo" }],
      },
    });
    expect(result.success).toBe(false);
  });

  test("rejects MCP server with empty command", () => {
    const result = configSchema.safeParse({
      mcp: {
        servers: [{ name: "test", command: "" }],
      },
    });
    expect(result.success).toBe(false);
  });

  test("validates MCP with multiple servers", () => {
    const result = configSchema.safeParse({
      mcp: {
        servers: [
          { name: "server1", command: "cmd1" },
          { name: "server2", command: "cmd2", args: ["--port", "3000"] },
        ],
      },
    });
    expect(result.success).toBe(true);
  });

  test("validates MCP server with env as record of strings", () => {
    const result = configSchema.safeParse({
      mcp: {
        servers: [
          {
            name: "test",
            command: "node",
            env: { API_KEY: "secret", NODE_ENV: "production" },
          },
        ],
      },
    });
    expect(result.success).toBe(true);
  });
});

// ── Email config ─────────────────────────────────────────────────────────────

describe("Config Schema: email channel", () => {
  test("validates full email config", () => {
    const result = configSchema.safeParse({
      channels: {
        email: {
          imap: { host: "imap.gmail.com", port: 993, user: "me@gmail.com", password: "pass", tls: true },
          smtp: { host: "smtp.gmail.com", port: 587, user: "me@gmail.com", password: "pass", tls: true },
          pollIntervalSeconds: 60,
          allowedSenders: ["trusted@example.com"],
          fromName: "My Bot",
        },
      },
    });
    expect(result.success).toBe(true);
  });

  test("provides defaults for email config fields", () => {
    const result = configSchema.parse({
      channels: {
        email: {
          imap: { host: "imap.gmail.com", user: "me@gmail.com", password: "pass" },
          smtp: { host: "smtp.gmail.com", user: "me@gmail.com", password: "pass" },
        },
      },
    });
    const email = result.channels!.email!;
    expect(email.imap.port).toBe(993);
    expect(email.imap.tls).toBe(true);
    expect(email.smtp.port).toBe(587);
    expect(email.smtp.tls).toBe(true);
    expect(email.pollIntervalSeconds).toBe(60);
    expect(email.enabled).toBe(true);
  });

  test("rejects email with pollIntervalSeconds below 10", () => {
    const result = configSchema.safeParse({
      channels: {
        email: {
          imap: { host: "imap.x.com", user: "u", password: "p" },
          smtp: { host: "smtp.x.com", user: "u", password: "p" },
          pollIntervalSeconds: 5,
        },
      },
    });
    expect(result.success).toBe(false);
  });

  test("rejects email with missing IMAP host", () => {
    const result = configSchema.safeParse({
      channels: {
        email: {
          imap: { host: "", user: "u", password: "p" },
          smtp: { host: "smtp.x.com", user: "u", password: "p" },
        },
      },
    });
    expect(result.success).toBe(false);
  });
});

// ── Webhooks config ──────────────────────────────────────────────────────────

describe("Config Schema: webhooks", () => {
  test("validates webhooks config", () => {
    const result = configSchema.safeParse({
      webhooks: { secret: "my-secret" },
    });
    expect(result.success).toBe(true);
  });

  test("validates webhooks with no secret", () => {
    const result = configSchema.safeParse({
      webhooks: {},
    });
    expect(result.success).toBe(true);
  });
});

// ── Code interpreter config ──────────────────────────────────────────────────

describe("Config Schema: codeInterpreter", () => {
  test("validates code interpreter config", () => {
    const result = configSchema.safeParse({
      codeInterpreter: {
        enabled: true,
        timeout: 15000,
        maxOutputSize: 25000,
      },
    });
    expect(result.success).toBe(true);
  });

  test("provides defaults for code interpreter", () => {
    const result = configSchema.parse({
      codeInterpreter: {},
    });
    expect(result.codeInterpreter!.enabled).toBe(true);
    expect(result.codeInterpreter!.timeout).toBe(30000);
    expect(result.codeInterpreter!.maxOutputSize).toBe(50000);
  });

  test("allows disabling code interpreter", () => {
    const result = configSchema.parse({
      codeInterpreter: { enabled: false },
    });
    expect(result.codeInterpreter!.enabled).toBe(false);
  });
});

// ── Image generation config ──────────────────────────────────────────────────

describe("Config Schema: imageGeneration", () => {
  test("validates openai image generation config", () => {
    const result = configSchema.safeParse({
      imageGeneration: {
        provider: "openai",
        apiKey: "sk-test",
        model: "dall-e-3",
        defaultSize: "1024x1024",
      },
    });
    expect(result.success).toBe(true);
  });

  test("validates fal provider", () => {
    const result = configSchema.safeParse({
      imageGeneration: {
        provider: "fal",
        apiKey: "fal-key",
      },
    });
    expect(result.success).toBe(true);
  });

  test("validates together provider", () => {
    const result = configSchema.safeParse({
      imageGeneration: {
        provider: "together",
        apiKey: "tog-key",
      },
    });
    expect(result.success).toBe(true);
  });

  test("rejects invalid provider", () => {
    const result = configSchema.safeParse({
      imageGeneration: {
        provider: "midjourney",
      },
    });
    expect(result.success).toBe(false);
  });

  test("provider is required when imageGeneration is set", () => {
    const result = configSchema.safeParse({
      imageGeneration: {
        apiKey: "key",
      },
    });
    expect(result.success).toBe(false);
  });
});

// ── Multi-provider config ────────────────────────────────────────────────────

describe("Config Schema: providers", () => {
  test("validates multi-provider config", () => {
    const result = configSchema.safeParse({
      providers: {
        anthropic: { model: "claude-sonnet-4-5-20250929", apiKey: "sk-ant" },
        openai: { model: "gpt-4o", apiKey: "sk-oai", baseUrl: "https://api.openai.com/v1" },
      },
      activeProvider: "anthropic",
    });
    expect(result.success).toBe(true);
  });

  test("validates provider with streaming option", () => {
    const result = configSchema.safeParse({
      providers: {
        anthropic: { model: "claude-sonnet-4-5-20250929", apiKey: "key", streaming: true },
      },
    });
    expect(result.success).toBe(true);
  });

  test("validates provider with contextWindow", () => {
    const result = configSchema.safeParse({
      providers: {
        local: { model: "llama-3", contextWindow: 32000 },
      },
    });
    expect(result.success).toBe(true);
  });

  test("validates failover list", () => {
    const result = configSchema.safeParse({
      providers: {
        anthropic: { model: "claude-sonnet-4-5-20250929", apiKey: "key" },
        openai: { model: "gpt-4o", apiKey: "key" },
      },
      activeProvider: "anthropic",
      failover: ["openai"],
    });
    expect(result.success).toBe(true);
  });
});

// ── Channel configs ──────────────────────────────────────────────────────────

describe("Config Schema: channels", () => {
  test("validates telegram channel", () => {
    const result = configSchema.safeParse({
      channels: {
        telegram: { botToken: "123:abc", allowedUsers: [12345, 67890] },
      },
    });
    expect(result.success).toBe(true);
  });

  test("validates discord channel", () => {
    const result = configSchema.safeParse({
      channels: {
        discord: { botToken: "discord-token", allowedUsers: ["user1", "user2"] },
      },
    });
    expect(result.success).toBe(true);
  });

  test("validates webchat channel", () => {
    const result = configSchema.safeParse({
      channels: {
        webchat: { port: 3000 },
      },
    });
    expect(result.success).toBe(true);
  });

  test("validates slack channel", () => {
    const result = configSchema.safeParse({
      channels: {
        slack: { botToken: "xoxb-test", appToken: "xapp-test" },
      },
    });
    expect(result.success).toBe(true);
  });

  test("validates whatsapp channel", () => {
    const result = configSchema.safeParse({
      channels: {
        whatsapp: { allowedNumbers: ["+1234567890"] },
      },
    });
    expect(result.success).toBe(true);
  });

  test("validates signal channel", () => {
    const result = configSchema.safeParse({
      channels: {
        signal: { phoneNumber: "+1234567890" },
      },
    });
    expect(result.success).toBe(true);
  });

  test("validates all channels together", () => {
    const result = configSchema.safeParse({
      channels: {
        telegram: { botToken: "tg-token" },
        discord: { botToken: "dc-token" },
        webchat: {},
        slack: { botToken: "xoxb-test", appToken: "xapp-test" },
        email: {
          imap: { host: "imap.x.com", user: "u", password: "p" },
          smtp: { host: "smtp.x.com", user: "u", password: "p" },
        },
      },
    });
    expect(result.success).toBe(true);
  });

  test("rejects telegram with empty botToken", () => {
    const result = configSchema.safeParse({
      channels: {
        telegram: { botToken: "" },
      },
    });
    expect(result.success).toBe(false);
  });

  test("telegram defaults enabled to true", () => {
    const result = configSchema.parse({
      channels: {
        telegram: { botToken: "test" },
      },
    });
    expect(result.channels!.telegram!.enabled).toBe(true);
  });
});

// ── Budget config ────────────────────────────────────────────────────────────

describe("Config Schema: budget", () => {
  test("validates budget config", () => {
    const result = configSchema.safeParse({
      budget: {
        dailyLimitUsd: 5.0,
        monthlyLimitUsd: 100.0,
        alertThreshold: 0.9,
      },
    });
    expect(result.success).toBe(true);
  });

  test("defaults alertThreshold to 0.8", () => {
    const result = configSchema.parse({
      budget: {},
    });
    expect(result.budget!.alertThreshold).toBe(0.8);
  });

  test("rejects alertThreshold below 0", () => {
    const result = configSchema.safeParse({
      budget: { alertThreshold: -0.1 },
    });
    expect(result.success).toBe(false);
  });

  test("rejects alertThreshold above 1", () => {
    const result = configSchema.safeParse({
      budget: { alertThreshold: 1.5 },
    });
    expect(result.success).toBe(false);
  });
});

// ── Rate limit config ────────────────────────────────────────────────────────

describe("Config Schema: rateLimit", () => {
  test("validates rate limit config", () => {
    const result = configSchema.safeParse({
      rateLimit: { chatPerMinute: 30, uploadPerMinute: 5 },
    });
    expect(result.success).toBe(true);
  });

  test("provides defaults for rate limit", () => {
    const result = configSchema.parse({
      rateLimit: {},
    });
    expect(result.rateLimit!.chatPerMinute).toBe(60);
    expect(result.rateLimit!.uploadPerMinute).toBe(10);
  });
});

// ── Smart routing config ─────────────────────────────────────────────────────

describe("Config Schema: smartRouting", () => {
  test("validates smart routing config", () => {
    const result = configSchema.safeParse({
      smartRouting: {
        enabled: true,
        fastProvider: "openai",
        fastModel: "gpt-4o-mini",
      },
    });
    expect(result.success).toBe(true);
  });

  test("defaults enabled to false", () => {
    const result = configSchema.parse({
      smartRouting: {},
    });
    expect(result.smartRouting!.enabled).toBe(false);
  });
});

// ── Sandbox config ───────────────────────────────────────────────────────────

describe("Config Schema: sandbox", () => {
  test("validates sandbox config", () => {
    const result = configSchema.safeParse({
      sandbox: { enabled: true, timeoutMs: 15000 },
    });
    expect(result.success).toBe(true);
  });

  test("provides defaults for sandbox", () => {
    const result = configSchema.parse({
      sandbox: {},
    });
    expect(result.sandbox!.enabled).toBe(true);
    expect(result.sandbox!.timeoutMs).toBe(30000);
  });
});

describe("Config Schema: memory retrieval + tool scopes", () => {
  test("validates memoryRetrieval tuning", () => {
    const result = configSchema.safeParse({
      memoryRetrieval: {
        contextTopK: 4,
        minConfidence: 0.25,
      },
    });
    expect(result.success).toBe(true);
  });

  test("rejects out-of-range memoryRetrieval values", () => {
    expect(configSchema.safeParse({ memoryRetrieval: { contextTopK: 0, minConfidence: 0.2 } }).success).toBe(false);
    expect(configSchema.safeParse({ memoryRetrieval: { contextTopK: 2, minConfidence: 1.5 } }).success).toBe(false);
  });

  test("validates toolScopes config", () => {
    const result = configSchema.safeParse({
      toolScopes: {
        allowed: ["memory", "network_read"],
        dryRunByDefault: true,
      },
    });
    expect(result.success).toBe(true);
  });

  test("validates approvals config", () => {
    const result = configSchema.safeParse({
      approvals: {
        autoApproveFirstPartyTools: true,
      },
    });
    expect(result.success).toBe(true);
  });
});

// ── Full config ──────────────────────────────────────────────────────────────

describe("Config Schema: full config", () => {
  test("validates a comprehensive configuration", () => {
    const result = configSchema.safeParse({
      providers: {
        anthropic: { model: "claude-sonnet-4-5-20250929", apiKey: "sk-ant" },
      },
      activeProvider: "anthropic",
      channels: {
        telegram: { botToken: "tg" },
        webchat: { port: 8080 },
      },
      maxTurns: 100,
      heartbeatMinutes: 15,
      budget: { monthlyLimitUsd: 50 },
      codeInterpreter: { enabled: true },
      imageGeneration: { provider: "openai", apiKey: "sk-img" },
      mcp: { servers: [{ name: "fs", command: "npx", args: ["-y", "mcp-fs"] }] },
      webhooks: { secret: "whsec" },
      smartRouting: { enabled: false },
      sandbox: { enabled: true },
      rateLimit: { chatPerMinute: 30 },
      auth: { enabled: true },
    });
    expect(result.success).toBe(true);
  });
});
