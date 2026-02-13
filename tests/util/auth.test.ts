import { describe, test, expect } from "bun:test";
import {
  generateApiKey,
  hashApiKey,
  generateSessionToken,
  validateSessionToken,
} from "../../src/util/auth";

describe("generateApiKey", () => {
  test("returns a 64-character hex string", () => {
    const key = generateApiKey();
    expect(key).toHaveLength(64);
    expect(key).toMatch(/^[0-9a-f]{64}$/);
  });

  test("generates unique keys on each call", () => {
    const key1 = generateApiKey();
    const key2 = generateApiKey();
    expect(key1).not.toBe(key2);
  });
});

describe("hashApiKey", () => {
  test("returns a consistent hash for the same input", () => {
    const key = "test-api-key-12345";
    const hash1 = hashApiKey(key);
    const hash2 = hashApiKey(key);
    expect(hash1).toBe(hash2);
  });

  test("returns different hashes for different keys", () => {
    const hash1 = hashApiKey("key-alpha");
    const hash2 = hashApiKey("key-beta");
    expect(hash1).not.toBe(hash2);
  });

  test("returns a 64-character hex string (SHA-256)", () => {
    const hash = hashApiKey("anything");
    expect(hash).toHaveLength(64);
    expect(hash).toMatch(/^[0-9a-f]{64}$/);
  });
});

describe("session tokens", () => {
  test("validateSessionToken returns false for an unknown token", () => {
    expect(validateSessionToken("nonexistent-token")).toBe(false);
  });

  test("generateSessionToken creates a token that can be validated", () => {
    const token = generateSessionToken();
    expect(validateSessionToken(token)).toBe(true);
  });

  test("token is single-use (deleted after validation)", () => {
    const token = generateSessionToken();
    expect(validateSessionToken(token)).toBe(true);
    expect(validateSessionToken(token)).toBe(false);
  });

  test("validateSessionToken returns false for an expired token", () => {
    const token = generateSessionToken();

    // Reach into the module-level Map to force the expiry into the past.
    // The Map is not exported, but we can simulate expiry by generating the
    // token and then monkey-patching Date.now to return a future time.
    const realDateNow = Date.now;
    try {
      // Move time forward by 2 hours (tokens expire after 1 hour)
      Date.now = () => realDateNow() + 2 * 60 * 60 * 1000;
      expect(validateSessionToken(token)).toBe(false);
    } finally {
      Date.now = realDateNow;
    }
  });
});
