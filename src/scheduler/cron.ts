import { Cron } from "croner";
import { Database } from "bun:sqlite";
import type { MessageRouter } from "../channels/router";
import { logger } from "../util/logger";

interface CronJob {
  id: number;
  name: string;
  schedule: string;
  task: string;
  enabled: number;
  retry_count: number;
  max_retries: number;
}

const activeCrons: Map<number, Cron> = new Map();

export function initCronScheduler(db: Database, router: MessageRouter) {
  const jobs = db
    .query("SELECT * FROM cron_jobs WHERE enabled = 1")
    .all() as CronJob[];

  for (const job of jobs) {
    scheduleJob(db, job, router);
  }

  logger.info("Cron scheduler initialized", { jobCount: jobs.length });
}

function scheduleJob(db: Database, job: CronJob, router: MessageRouter) {
  if (activeCrons.has(job.id)) {
    activeCrons.get(job.id)!.stop();
  }

  let cron: Cron;
  try {
    cron = new Cron(job.schedule, async () => {
    logger.info(`Cron job firing: ${job.name}`);

    // Log start
    const logResult = db
      .prepare(
        "INSERT INTO cron_logs (job_id, status) VALUES (?, 'running')"
      )
      .run(job.id);
    const logId = Number(logResult.lastInsertRowid);

    try {
      // Use a dedicated session for cron tasks
      const sessionKey = `cron:${job.name}`;
      const reply = await router.sendProactive(sessionKey, job.task);

      // Log success
      db.prepare(
        "UPDATE cron_logs SET status = 'success', output = ?, finished_at = datetime('now') WHERE id = ?"
      ).run(reply || "", logId);

      // Update last_run
      db.prepare(
        "UPDATE cron_jobs SET last_run = datetime('now'), retry_count = 0 WHERE id = ?"
      ).run(job.id);
    } catch (err: any) {
      logger.error(`Cron job failed: ${job.name}`, { error: err.message });

      // Log failure
      db.prepare(
        "UPDATE cron_logs SET status = 'failed', error = ?, finished_at = datetime('now') WHERE id = ?"
      ).run(err.message, logId);

      // Increment retry count
      const newRetry = job.retry_count + 1;
      if (newRetry >= job.max_retries) {
        logger.warn(`Cron job disabled after ${job.max_retries} retries: ${job.name}`);
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

export function addCronJob(
  db: Database,
  name: string,
  schedule: string,
  task: string,
  router: MessageRouter
) {
  const result = db
    .prepare(
      "INSERT INTO cron_jobs (name, schedule, task) VALUES (?, ?, ?)"
    )
    .run(name, schedule, task);

  const id = Number(result.lastInsertRowid);
  const job: CronJob = {
    id,
    name,
    schedule,
    task,
    enabled: 1,
    retry_count: 0,
    max_retries: 3,
  };

  scheduleJob(db, job, router);
  logger.info(`Cron job added: ${name}`, { schedule, task });
}

export function stopAllCrons() {
  for (const [id, cron] of activeCrons) {
    cron.stop();
  }
  activeCrons.clear();
}
