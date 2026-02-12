import { logger } from "../util/logger";

type HeartbeatHandler = () => Promise<void>;

const handlers: HeartbeatHandler[] = [];
let interval: ReturnType<typeof setInterval> | null = null;

const HEARTBEAT_INTERVAL_MS = 60_000; // 1 minute

export function onHeartbeat(handler: HeartbeatHandler) {
  handlers.push(handler);
}

export function startHeartbeat() {
  if (interval) return;

  logger.info("Heartbeat started", {
    intervalMs: HEARTBEAT_INTERVAL_MS,
  });

  interval = setInterval(async () => {
    for (const handler of handlers) {
      try {
        await handler();
      } catch (err: any) {
        logger.error("Heartbeat handler error", { error: err.message });
      }
    }
  }, HEARTBEAT_INTERVAL_MS);
}

export function stopHeartbeat() {
  if (interval) {
    clearInterval(interval);
    interval = null;
  }
}
