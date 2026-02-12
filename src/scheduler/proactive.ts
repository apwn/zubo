import { Database } from "bun:sqlite";
import type { MessageRouter } from "../channels/router";
import type { LlmProvider } from "../llm/provider";
import type { ZuboConfig } from "../config/schema";
import { onHeartbeat } from "./heartbeat";
import { checkMemoryTriggers } from "./memory-triggers";
import { logger } from "../util/logger";

export function initProactiveIntelligence(
  db: Database,
  router: MessageRouter,
  llm: LlmProvider,
  _config: ZuboConfig
): void {
  // Register heartbeat handler for proactive checks
  onHeartbeat(async () => {
    try {
      await checkMemoryTriggers(db, router, llm);
    } catch (err: any) {
      logger.error("Proactive trigger check failed", { error: err.message });
    }
  });

  logger.info("Proactive intelligence initialized");
}
