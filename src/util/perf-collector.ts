import { statSync } from "fs";
import { onHeartbeat } from "../scheduler/heartbeat";
import { getDb } from "../db/connection";
import { paths } from "../config/paths";
import { logger } from "./logger";

/**
 * Register a heartbeat handler that records performance snapshots.
 */
export function initPerfCollector(): void {
  onHeartbeat(async () => {
    try {
      const db = getDb();
      const memUsage = process.memoryUsage();
      const rssMb = Math.round((memUsage.rss / 1_048_576) * 100) / 100;
      const heapMb = Math.round((memUsage.heapUsed / 1_048_576) * 100) / 100;

      let dbSizeMb = 0;
      try {
        const stat = statSync(paths.db);
        dbSizeMb = Math.round((stat.size / 1_048_576) * 100) / 100;
      } catch {}

      db.prepare(
        "INSERT INTO perf_snapshots (rss_mb, heap_mb, db_size_mb) VALUES (?, ?, ?)"
      ).run(rssMb, heapMb, dbSizeMb);
    } catch (err: any) {
      logger.debug("Perf snapshot failed", { error: err.message });
    }
  });

  logger.info("Performance collector initialized");
}
