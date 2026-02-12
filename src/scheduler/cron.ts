import { Cron } from "croner";
import { Database } from "bun:sqlite";
import type { MessageRouter } from "../channels/router";
import type { ZuboConfig } from "../config/schema";
import type { LlmProvider } from "../llm/provider";
import { delegateToAgent } from "../agent/delegate";
import { logger } from "../util/logger";

export interface CronJob {
  id: number;
  name: string;
  schedule: string;
  task: string;
  enabled: number;
  last_run: string | null;
  retry_count: number;
  max_retries: number;
  agent: string | null;
}

const activeCrons: Map<number, Cron> = new Map();

export function initCronScheduler(
  db: Database,
  router: MessageRouter,
  config: ZuboConfig,
  llm?: LlmProvider
) {
  const jobs = db
    .query("SELECT * FROM cron_jobs WHERE enabled = 1")
    .all() as CronJob[];

  for (const job of jobs) {
    scheduleJob(db, job, router, config, llm);
  }

  logger.info("Cron scheduler initialized", { jobCount: jobs.length });
}

function getOwnerSessionKey(config: ZuboConfig): string | null {
  if (config.telegramAllowedUsers.length > 0) {
    return `telegram:${config.telegramAllowedUsers[0]}`;
  }
  return null;
}

function scheduleJob(
  db: Database,
  job: CronJob,
  router: MessageRouter,
  config: ZuboConfig,
  llm?: LlmProvider
) {
  if (activeCrons.has(job.id)) {
    activeCrons.get(job.id)!.stop();
  }

  let cron: Cron;
  try {
    cron = new Cron(job.schedule, async () => {
      logger.info(`Cron job firing: ${job.name}`);

      const sessionKey = getOwnerSessionKey(config);
      if (!sessionKey) {
        logger.warn("No owner registered, skipping cron job");
        return;
      }

      // Log start
      const logResult = db
        .prepare(
          "INSERT INTO cron_logs (job_id, status) VALUES (?, 'running')"
        )
        .run(job.id);
      const logId = Number(logResult.lastInsertRowid);

      try {
        let reply: string;

        // If job has an agent and we have an LLM provider, delegate to the agent
        if (job.agent && llm) {
          reply = await delegateToAgent(llm, job.agent, job.task);
        } else {
          reply = await router.sendProactive(sessionKey, job.task);
        }

        // Log success
        db.prepare(
          "UPDATE cron_logs SET status = 'success', output = ?, finished_at = datetime('now') WHERE id = ?"
        ).run(reply || "", logId);

        // Update last_run
        db.prepare(
          "UPDATE cron_jobs SET last_run = datetime('now'), retry_count = 0 WHERE id = ?"
        ).run(job.id);

        // Send result to owner if delegated to agent
        if (job.agent && llm && reply) {
          const adapter = router as any;
          try {
            // Try to send through router's proactive channel
            const sessionAdapter = (router as any).adapters ?? (router as any);
            // Simplified: just log that the agent completed. The reply is already logged.
            logger.info(`Agent "${job.agent}" completed cron task "${job.name}"`);
          } catch {
            // Non-critical, reply is already logged
          }
        }
      } catch (err: any) {
        logger.error(`Cron job failed: ${job.name}`, { error: err.message });

        // Log failure
        db.prepare(
          "UPDATE cron_logs SET status = 'failed', error = ?, finished_at = datetime('now') WHERE id = ?"
        ).run(err.message, logId);

        // Increment retry count
        const newRetry = job.retry_count + 1;
        if (newRetry >= job.max_retries) {
          logger.warn(
            `Cron job disabled after ${job.max_retries} retries: ${job.name}`
          );
          db.prepare(
            "UPDATE cron_jobs SET enabled = 0, retry_count = ? WHERE id = ?"
          ).run(newRetry, job.id);
          activeCrons.get(job.id)?.stop();
          activeCrons.delete(job.id);
        } else {
          db.prepare(
            "UPDATE cron_jobs SET retry_count = ? WHERE id = ?"
          ).run(newRetry, job.id);
        }
      }
    });
  } catch (err: any) {
    logger.error(`Invalid cron schedule for job '${job.name}'`, {
      schedule: job.schedule,
      error: err.message,
    });
    db.prepare("UPDATE cron_jobs SET enabled = 0 WHERE id = ?").run(job.id);
    return;
  }

  activeCrons.set(job.id, cron);
}

const MAX_CRON_JOBS = 50;

/**
 * Validate a cron schedule is not too aggressive.
 * Rejects schedules that fire more than once per minute.
 */
function validateCronSchedule(schedule: string): void {
  // Quick check: if it has 6 fields (seconds), reject sub-minute schedules
  const parts = schedule.trim().split(/\s+/);
  if (parts.length === 6 && parts[0] !== "0") {
    throw new Error(
      "Sub-minute cron schedules are not allowed. Use at least 1-minute intervals."
    );
  }

  // Try to parse and check next 2 runs are at least 60s apart
  try {
    const cron = new Cron(schedule);
    const next1 = cron.nextRun();
    const next2 = cron.nextRuns(2)[1];
    if (next1 && next2) {
      const gapMs = next2.getTime() - next1.getTime();
      if (gapMs < 60_000) {
        throw new Error(
          "Cron schedule fires too frequently. Minimum interval is 1 minute."
        );
      }
    }
    cron.stop();
  } catch (err: any) {
    if (err.message?.includes("too frequently") || err.message?.includes("Sub-minute")) {
      throw err;
    }
    throw new Error(`Invalid cron expression: ${schedule}`);
  }
}

export function addCronJob(
  db: Database,
  name: string,
  schedule: string,
  task: string,
  router: MessageRouter,
  config: ZuboConfig,
  agent?: string,
  llm?: LlmProvider
) {
  // Validate schedule interval
  validateCronSchedule(schedule);

  // Enforce max active jobs
  const activeCount = db
    .query("SELECT COUNT(*) as c FROM cron_jobs WHERE enabled = 1")
    .get() as { c: number };
  if (activeCount.c >= MAX_CRON_JOBS) {
    throw new Error(
      `Maximum ${MAX_CRON_JOBS} active cron jobs allowed. Delete or disable some first.`
    );
  }

  const result = db
    .prepare(
      "INSERT INTO cron_jobs (name, schedule, task, agent) VALUES (?, ?, ?, ?)"
    )
    .run(name, schedule, task, agent ?? null);

  const id = Number(result.lastInsertRowid);
  const job: CronJob = {
    id,
    name,
    schedule,
    task,
    enabled: 1,
    last_run: null,
    retry_count: 0,
    max_retries: 3,
    agent: agent ?? null,
  };

  scheduleJob(db, job, router, config, llm);
  logger.info(`Cron job added: ${name}`, { schedule, task, agent });
}

export function removeCronJob(db: Database, name: string): boolean {
  const job = db
    .query("SELECT id FROM cron_jobs WHERE name = ?")
    .get(name) as { id: number } | null;
  if (!job) return false;

  if (activeCrons.has(job.id)) {
    activeCrons.get(job.id)!.stop();
    activeCrons.delete(job.id);
  }

  db.prepare("DELETE FROM cron_logs WHERE job_id = ?").run(job.id);
  db.prepare("DELETE FROM cron_jobs WHERE id = ?").run(job.id);
  logger.info(`Cron job removed: ${name}`);
  return true;
}

export function listCronJobs(db: Database): CronJob[] {
  return db
    .query("SELECT * FROM cron_jobs ORDER BY created_at DESC")
    .all() as CronJob[];
}

export function stopAllCrons() {
  for (const [id, cron] of activeCrons) {
    cron.stop();
  }
  activeCrons.clear();
}
