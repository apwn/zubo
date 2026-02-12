import { describe, it, expect } from "bun:test";
import { configSchema } from "../src/config/schema";

describe("Config Schema", () => {
  it("should validate minimal config", () => {
    const result = configSchema.safeParse({
      anthropicApiKey: "test-key",
    });
    expect(result.success).toBe(true);
  });

  it("should provide defaults", () => {
    const result = configSchema.parse({
      anthropicApiKey: "test-key",
    });
    expect(result.maxTurns).toBe(50);
    expect(result.heartbeatMinutes).toBe(30);
    expect(result.telegramAllowedUsers).toEqual([]);
  });

  it("should validate multi-provider config", () => {
    const result = configSchema.safeParse({
      providers: {
        anthropic: { model: "claude-sonnet-4-5-20250929", apiKey: "test" },
        openai: { model: "gpt-4o", apiKey: "test", baseUrl: "https://api.openai.com/v1" },
      },
      activeProvider: "anthropic",
    });
    expect(result.success).toBe(true);
  });

  it("should validate channel config", () => {
    const result = configSchema.safeParse({
      anthropicApiKey: "test",
      channels: {
        telegram: { botToken: "123:abc", allowedUsers: [12345] },
        discord: { botToken: "discord-token" },
        webchat: { port: 3000 },
      },
    });
    expect(result.success).toBe(true);
  });

  it("should reject invalid heartbeat values", () => {
    const result = configSchema.safeParse({
      anthropicApiKey: "test",
      heartbeatMinutes: 0,
    });
    expect(result.success).toBe(false);
  });
});
