import { logger } from "../util/logger";

type HeartbeatHandler = () => Promise<void>;

const handlers: HeartbeatHandler[] = [];
let timer: ReturnType<typeof setInterval> | null = null;
let currentIntervalMs = 30 * 60_000; // default 30 minutes

const DEFAULT_HEARTBEAT_MINUTES = 30;

export function onHeartbeat(handler: HeartbeatHandler) {
  handlers.push(handler);
}

/**
 * Start the heartbeat with a configurable interval.
 * @param minutes — interval in minutes (default 30, min 1, max 1440)
 */
export function startHeartbeat(minutes?: number) {
  if (timer) return;

  const mins = Math.max(1, Math.min(1440, minutes ?? DEFAULT_HEARTBEAT_MINUTES));
  currentIntervalMs = mins * 60_000;

  logger.info("Heartbeat started", {
    intervalMinutes: mins,
  });

  timer = setInterval(async () => {
    if (handlers.length === 0) return;

    // Run all handlers in parallel — one slow handler shouldn't block others
    const results = await Promise.allSettled(handlers.map((h) => h()));
    for (const r of results) {
      if (r.status === "rejected") {
        logger.error("Heartbeat handler error", { error: r.reason?.message ?? String(r.reason) });
      }
    }
  }, currentIntervalMs);
}

export function stopHeartbeat() {
  if (timer) {
    clearInterval(timer);
    timer = null;
  }
}

/** Restart heartbeat with a new interval. */
export function restartHeartbeat(minutes: number) {
  stopHeartbeat();
  startHeartbeat(minutes);
}

/** Get the current heartbeat interval in minutes. */
export function getHeartbeatMinutes(): number {
  return currentIntervalMs / 60_000;
}
