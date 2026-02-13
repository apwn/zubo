import { describe, test, expect, afterEach } from "bun:test";
import { RateLimiter } from "../../src/util/rate-limiter";

describe("RateLimiter", () => {
  let limiter: RateLimiter;

  afterEach(() => {
    limiter?.destroy();
  });

  test("allows requests under the limit", () => {
    limiter = new RateLimiter(3, 60_000);

    const r1 = limiter.check("user-1");
    const r2 = limiter.check("user-1");
    const r3 = limiter.check("user-1");

    expect(r1.allowed).toBe(true);
    expect(r2.allowed).toBe(true);
    expect(r3.allowed).toBe(true);
  });

  test("blocks requests over the limit", () => {
    limiter = new RateLimiter(2, 60_000);

    limiter.check("user-1");
    limiter.check("user-1");
    const result = limiter.check("user-1");

    expect(result.allowed).toBe(false);
  });

  test("returns retryAfterMs when blocked", () => {
    limiter = new RateLimiter(1, 60_000);

    limiter.check("user-1");
    const result = limiter.check("user-1");

    expect(result.allowed).toBe(false);
    expect(result.retryAfterMs).toBeDefined();
    expect(result.retryAfterMs!).toBeGreaterThan(0);
    expect(result.retryAfterMs!).toBeLessThanOrEqual(60_000);
  });

  test("tracks keys independently", () => {
    limiter = new RateLimiter(1, 60_000);

    const r1 = limiter.check("user-a");
    const r2 = limiter.check("user-b");

    expect(r1.allowed).toBe(true);
    expect(r2.allowed).toBe(true);
  });

  test("resets after window expires", () => {
    const windowMs = 100;
    limiter = new RateLimiter(1, windowMs);

    limiter.check("user-1");
    const blocked = limiter.check("user-1");
    expect(blocked.allowed).toBe(false);

    // Move time forward past the window using Date.now override
    const realDateNow = Date.now;
    try {
      Date.now = () => realDateNow() + windowMs + 50;
      const afterWindow = limiter.check("user-1");
      expect(afterWindow.allowed).toBe(true);
    } finally {
      Date.now = realDateNow;
    }
  });
});
