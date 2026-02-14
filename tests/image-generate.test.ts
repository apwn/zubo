import { describe, test, expect, beforeEach, afterEach } from "bun:test";
import { mkdirSync, writeFileSync, existsSync, unlinkSync, readFileSync } from "fs";
import { join } from "path";
import { homedir } from "os";

/**
 * Tests for the image-generate handler.
 *
 * The handler reads config from ~/.zubo/config.json and makes API calls.
 * We test validation logic (missing prompt, prompt too long) and config reading.
 * We do NOT make real API calls -- those tests would require valid API keys.
 *
 * Since the handler reads config from disk, we create/clean up temp config files.
 */

const CONFIG_DIR = join(homedir(), ".zubo");
const CONFIG_PATH = join(CONFIG_DIR, "config.json");

let originalConfig: string | null = null;

function backupConfig() {
  try {
    if (existsSync(CONFIG_PATH)) {
      originalConfig = readFileSync(CONFIG_PATH, "utf-8");
    }
  } catch {
    originalConfig = null;
  }
}

function restoreConfig() {
  try {
    if (originalConfig !== null) {
      writeFileSync(CONFIG_PATH, originalConfig);
    }
  } catch {}
}

function writeTestConfig(config: Record<string, unknown>) {
  mkdirSync(CONFIG_DIR, { recursive: true });
  writeFileSync(CONFIG_PATH, JSON.stringify(config));
}

// Import handler fresh each time -- use dynamic import
async function getHandler() {
  // Re-import to get fresh module
  return (await import("../src/tools/builtin-skills/image-generate/handler")).default;
}

// ── Validation ───────────────────────────────────────────────────────────────

describe("image-generate: validation", () => {
  test("throws when prompt is missing", async () => {
    const handler = await getHandler();
    expect(handler({})).rejects.toThrow("'prompt' is required");
  });

  test("throws when prompt is empty string", async () => {
    const handler = await getHandler();
    expect(handler({ prompt: "" })).rejects.toThrow("'prompt' is required");
  });

  test("throws when prompt exceeds 4000 characters", async () => {
    const handler = await getHandler();
    const longPrompt = "a".repeat(4001);
    expect(handler({ prompt: longPrompt })).rejects.toThrow("Prompt too long");
  });

  test("accepts prompt exactly 4000 characters (at boundary)", async () => {
    const handler = await getHandler();
    const exactPrompt = "a".repeat(4000);
    // This will fail at getConfig() since no imageGeneration config is set,
    // but it should NOT fail on the prompt length check
    try {
      await handler({ prompt: exactPrompt });
    } catch (err: any) {
      // Should fail on config, not on prompt length
      expect(err.message).not.toContain("Prompt too long");
    }
  });
});

// ── Config reading ───────────────────────────────────────────────────────────

describe("image-generate: config", () => {
  beforeEach(() => {
    backupConfig();
  });

  afterEach(() => {
    restoreConfig();
  });

  test("throws when imageGeneration is not configured", async () => {
    writeTestConfig({ providers: {} });
    const handler = await getHandler();
    expect(handler({ prompt: "a cat" })).rejects.toThrow("not configured");
  });

  test("throws when no API key is found", async () => {
    writeTestConfig({
      imageGeneration: { provider: "openai" },
    });
    const handler = await getHandler();
    expect(handler({ prompt: "a cat" })).rejects.toThrow("No API key");
  });

  test("falls back to provider API key if imageGeneration.apiKey is missing", async () => {
    writeTestConfig({
      imageGeneration: { provider: "openai" },
      providers: { openai: { apiKey: "sk-test", model: "gpt-4o" } },
    });
    const handler = await getHandler();
    // Should NOT throw about API key; will fail on the actual API call
    try {
      await handler({ prompt: "a cat" });
    } catch (err: any) {
      // It should get past config reading and fail on the fetch call
      expect(err.message).not.toContain("No API key");
    }
  });

  test("uses imageGeneration.apiKey when directly provided", async () => {
    writeTestConfig({
      imageGeneration: { provider: "openai", apiKey: "sk-direct-test" },
    });
    const handler = await getHandler();
    // Should NOT throw about API key
    try {
      await handler({ prompt: "a cat" });
    } catch (err: any) {
      expect(err.message).not.toContain("No API key");
      expect(err.message).not.toContain("not configured");
    }
  });
});

// ── Provider validation in handler ───────────────────────────────────────────

describe("image-generate: provider selection", () => {
  beforeEach(() => {
    backupConfig();
  });

  afterEach(() => {
    restoreConfig();
  });

  test("unknown provider throws error", async () => {
    writeTestConfig({
      imageGeneration: { provider: "midjourney", apiKey: "fake-key" },
    });
    const handler = await getHandler();
    expect(handler({ prompt: "a cat" })).rejects.toThrow("Unknown provider");
  });
});
