import { describe, it, expect, beforeEach } from "bun:test";
import { Database } from "bun:sqlite";
import {
  generateApiKey,
  hashApiKey,
  initAuth,
  createApiKey,
  listApiKeys,
  deleteApiKey,
  validateRequest,
  generateSessionToken,
  validateSessionToken,
} from "../src/util/auth";

describe("Auth", () => {
  let db: Database;

  beforeEach(() => {
    db = new Database(":memory:");
    initAuth(db);
  });

  it("should generate a 64-character hex API key", () => {
    const key = generateApiKey();
    expect(key).toHaveLength(64);
    expect(/^[a-f0-9]{64}$/.test(key)).toBe(true);
  });

  it("should hash an API key deterministically", () => {
    const key = "abc123";
    const hash1 = hashApiKey(key);
    const hash2 = hashApiKey(key);
    expect(hash1).toBe(hash2);
    expect(hash1).not.toBe(key);
    expect(hash1).toHaveLength(64); // SHA-256 hex
  });

  it("should validate a valid Bearer token", () => {
    const result = createApiKey(db, "test-key");
    const req = new Request("http://localhost/api/chat", {
      headers: { Authorization: `Bearer ${result.key}` },
    });
    expect(validateRequest(db, req)).toBe(true);
  });

  it("should reject a missing token", () => {
    const req = new Request("http://localhost/api/chat");
    expect(validateRequest(db, req)).toBe(false);
  });

  it("should reject an invalid token", () => {
    createApiKey(db, "real-key");
    const req = new Request("http://localhost/api/chat", {
      headers: { Authorization: "Bearer invalidtoken123" },
    });
    expect(validateRequest(db, req)).toBe(false);
  });

  it("should create, list, and delete keys", () => {
    const k1 = createApiKey(db, "key-1");
    const k2 = createApiKey(db, "key-2");

    const keys = listApiKeys(db);
    expect(keys).toHaveLength(2);
    expect(keys[0].label).toBe("key-1");
    expect(keys[1].label).toBe("key-2");

    const deleted = deleteApiKey(db, k1.id);
    expect(deleted).toBe(true);

    const remaining = listApiKeys(db);
    expect(remaining).toHaveLength(1);
    expect(remaining[0].id).toBe(k2.id);
  });

  it("should handle dashboard session tokens", () => {
    const token = generateSessionToken();
    expect(typeof token).toBe("string");

    // Valid on first use
    expect(validateSessionToken(token)).toBe(true);
    // Invalid on second use (single-use)
    expect(validateSessionToken(token)).toBe(false);
  });

  it("should reject invalid session tokens", () => {
    expect(validateSessionToken("nonexistent-token")).toBe(false);
  });
});
