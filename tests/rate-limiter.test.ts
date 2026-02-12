import { describe, it, expect, afterEach } from "bun:test";
import { RateLimiter } from "../src/util/rate-limiter";

describe("RateLimiter", () => {
  const limiters: RateLimiter[] = [];

  function create(max: number, windowMs: number) {
    const rl = new RateLimiter(max, windowMs);
    limiters.push(rl);
    return rl;
  }

  afterEach(() => {
    for (const rl of limiters) rl.destroy();
    limiters.length = 0;
  });

  it("should allow requests under the limit", () => {
    const rl = create(5, 60_000);
    for (let i = 0; i < 5; i++) {
      const result = rl.check("user1");
      expect(result.allowed).toBe(true);
    }
  });

  it("should block requests over the limit", () => {
    const rl = create(3, 60_000);
    rl.check("user1");
    rl.check("user1");
    rl.check("user1");
    const blocked = rl.check("user1");
    expect(blocked.allowed).toBe(false);
    expect(blocked.retryAfterMs).toBeGreaterThan(0);
  });

  it("should isolate keys independently", () => {
    const rl = create(2, 60_000);
    rl.check("user1");
    rl.check("user1");
    const blocked = rl.check("user1");
    expect(blocked.allowed).toBe(false);

    // Different key should still be allowed
    const other = rl.check("user2");
    expect(other.allowed).toBe(true);
  });

  it("should allow requests after the window expires", async () => {
    // Use a very short window
    const rl = create(1, 50);
    rl.check("user1");
    const blocked = rl.check("user1");
    expect(blocked.allowed).toBe(false);

    // Wait for window to expire
    await new Promise((r) => setTimeout(r, 60));
    const allowed = rl.check("user1");
    expect(allowed.allowed).toBe(true);
  });

  it("should report accurate Retry-After values", () => {
    const rl = create(1, 60_000);
    rl.check("user1");
    const blocked = rl.check("user1");
    expect(blocked.allowed).toBe(false);
    // retryAfterMs should be roughly 60s (within a reasonable margin)
    expect(blocked.retryAfterMs).toBeGreaterThan(50_000);
    expect(blocked.retryAfterMs).toBeLessThanOrEqual(60_000);
  });
});
