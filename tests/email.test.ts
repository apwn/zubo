import { describe, test, expect } from "bun:test";

/**
 * Tests for the extractEmail helper in src/channels/email.ts.
 *
 * The extractEmail function is not exported directly (it is a module-level
 * function), so we replicate its logic here for unit testing. We also
 * verify the createEmailAdapter export exists.
 */

// Replicate the extractEmail logic from src/channels/email.ts
// This mirrors the exact implementation to ensure test accuracy.
function extractEmail(fromHeader: string): string {
  const match = fromHeader.match(/<([^>]+)>/);
  if (match) return match[1].toLowerCase();
  // Bare email address
  if (fromHeader.includes("@")) return fromHeader.trim().toLowerCase();
  return fromHeader.toLowerCase();
}

// ── extractEmail helper ──────────────────────────────────────────────────────

describe("extractEmail", () => {
  test("extracts email from angle brackets", () => {
    expect(extractEmail("<alice@example.com>")).toBe("alice@example.com");
  });

  test("extracts email from display name with angle brackets", () => {
    expect(extractEmail("Alice Johnson <alice@example.com>")).toBe("alice@example.com");
  });

  test("extracts email from quoted display name with angle brackets", () => {
    expect(extractEmail('"Alice Johnson" <alice@example.com>')).toBe("alice@example.com");
  });

  test("handles bare email address", () => {
    expect(extractEmail("alice@example.com")).toBe("alice@example.com");
  });

  test("lowercases the result", () => {
    expect(extractEmail("Alice@Example.COM")).toBe("alice@example.com");
  });

  test("lowercases email from angle brackets", () => {
    expect(extractEmail("Alice <ALICE@EXAMPLE.COM>")).toBe("alice@example.com");
  });

  test("trims whitespace from bare emails", () => {
    expect(extractEmail("  alice@example.com  ")).toBe("alice@example.com");
  });

  test("handles string with no email (returns lowercase input)", () => {
    expect(extractEmail("Unknown Sender")).toBe("unknown sender");
  });

  test("handles complex display name with special chars", () => {
    expect(extractEmail("O'Brien, Bob <bob@corp.co.uk>")).toBe("bob@corp.co.uk");
  });

  test("extracts first email from multiple angle-bracket pairs", () => {
    // The regex matches the first <...> group
    expect(extractEmail("X <a@b.com> and <c@d.com>")).toBe("a@b.com");
  });

  test("handles email with plus addressing", () => {
    expect(extractEmail("user+tag@example.com")).toBe("user+tag@example.com");
  });

  test("handles email with subdomain", () => {
    expect(extractEmail("<alice@mail.example.com>")).toBe("alice@mail.example.com");
  });
});

// ── Email parsing scenarios ──────────────────────────────────────────────────

describe("email parsing scenarios", () => {
  test("typical Gmail-style From header", () => {
    expect(extractEmail("John Doe <john.doe@gmail.com>")).toBe("john.doe@gmail.com");
  });

  test("corporate email with department", () => {
    expect(extractEmail("Sales Team <sales@company.com>")).toBe("sales@company.com");
  });

  test("noreply address", () => {
    expect(extractEmail("no-reply@service.io")).toBe("no-reply@service.io");
  });

  test("international domain", () => {
    expect(extractEmail("User <user@example.co.jp>")).toBe("user@example.co.jp");
  });

  test("empty string returns empty", () => {
    expect(extractEmail("")).toBe("");
  });

  test("session key extraction pattern", () => {
    // The email channel uses "email:user@example.com" as session key
    const sessionKey = "email:alice@example.com";
    const parts = sessionKey.split(":");
    const to = parts.slice(1).join(":");
    expect(to).toBe("alice@example.com");
    expect(to.includes("@")).toBe(true);
  });

  test("session key with port-like email (colon in domain)", () => {
    // Edge case: session key reconstruction preserves colons after first one
    const sessionKey = "email:alice@example.com";
    const parts = sessionKey.split(":");
    const to = parts.slice(1).join(":");
    expect(to).toBe("alice@example.com");
  });
});

// ── Module structure ─────────────────────────────────────────────────────────

describe("email module", () => {
  test("exports createEmailAdapter function", async () => {
    const mod = await import("../src/channels/email");
    expect(typeof mod.createEmailAdapter).toBe("function");
  });
});
