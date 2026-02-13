/**
 * Sliding-window rate limiter with per-key tracking.
 * Used for HTTP endpoints (per-IP) and channels (per-userId).
 */
export class RateLimiter {
  private static readonly MAX_KEYS = 10_000;
  private windows = new Map<string, number[]>();
  private maxRequests: number;
  private windowMs: number;
  private pruneTimer: ReturnType<typeof setInterval>;

  constructor(maxRequests: number, windowMs: number) {
    this.maxRequests = maxRequests;
    this.windowMs = windowMs;

    // Auto-prune expired entries every 60s
    this.pruneTimer = setInterval(() => this.prune(), 60_000);
    // Allow process to exit without waiting for timer
    if (this.pruneTimer.unref) this.pruneTimer.unref();
  }

  check(key: string): { allowed: boolean; retryAfterMs?: number } {
    const now = Date.now();
    const cutoff = now - this.windowMs;

    // Evict oldest entry if map is at capacity and this is a new key
    if (this.windows.size >= RateLimiter.MAX_KEYS && !this.windows.has(key)) {
      const firstKey = this.windows.keys().next().value;
      if (firstKey !== undefined) this.windows.delete(firstKey);
    }

    let timestamps = this.windows.get(key);
    if (!timestamps) {
      timestamps = [];
      this.windows.set(key, timestamps);
    }

    // Remove expired timestamps
    while (timestamps.length > 0 && timestamps[0] <= cutoff) {
      timestamps.shift();
    }

    if (timestamps.length >= this.maxRequests) {
      const oldestValid = timestamps[0];
      const retryAfterMs = oldestValid + this.windowMs - now;
      return { allowed: false, retryAfterMs: Math.max(retryAfterMs, 1) };
    }

    timestamps.push(now);
    return { allowed: true };
  }

  private prune(): void {
    const now = Date.now();
    const cutoff = now - this.windowMs;
    for (const [key, timestamps] of this.windows) {
      while (timestamps.length > 0 && timestamps[0] <= cutoff) {
        timestamps.shift();
      }
      if (timestamps.length === 0) {
        this.windows.delete(key);
      }
    }
  }

  destroy(): void {
    clearInterval(this.pruneTimer);
    this.windows.clear();
  }
}
