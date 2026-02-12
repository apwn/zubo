import { Database } from "bun:sqlite";
import type { LlmProvider } from "../llm/provider";
import type { MessageRouter } from "../channels/router";
import { agentLoop } from "../agent/loop";
import { logger } from "../util/logger";

const BRIEFING_TASK = `Generate a morning briefing for the user. Include:
1. Any upcoming calendar events today (if Google Calendar is connected)
2. Important unread emails (if Gmail is connected)
3. Recent GitHub notifications (if GitHub is connected)
4. Any pending tasks or reminders
5. A brief weather-appropriate greeting

Keep it concise and actionable. If services aren't connected, skip those sections gracefully.`;

export async function generateMorningBriefing(
  db: Database,
  router: MessageRouter,
  llm: LlmProvider
): Promise<string> {
  logger.info("Generating morning briefing...");

  try {
    const result = await agentLoop(llm, "briefing", BRIEFING_TASK, {
      maxRounds: 5,
    });

    if (result.reply && router.broadcastProactive) {
      await router.broadcastProactive(result.reply);
    }

    // Log the briefing
    try {
      db.prepare(
        "INSERT INTO proactive_log (type, message) VALUES ('briefing', ?)"
      ).run(result.reply.slice(0, 5000));
    } catch {}

    return result.reply;
  } catch (err: any) {
    logger.error("Morning briefing failed", { error: err.message });
    return "";
  }
}

/**
 * Ensure the morning briefing cron job exists.
 * Called during startup to auto-create it.
 */
export function ensureBriefingCron(db: Database): void {
  try {
    const existing = db.query(
      "SELECT id FROM cron_jobs WHERE name = 'zubo_morning_briefing'"
    ).get();

    if (!existing) {
      db.prepare(
        "INSERT INTO cron_jobs (name, schedule, task, enabled) VALUES (?, ?, ?, 1)"
      ).run(
        "zubo_morning_briefing",
        "0 9 * * 1-5",
        "Generate a morning briefing with calendar events, emails, and tasks for today."
      );
      logger.info("Created default morning briefing cron (weekdays at 9am)");
    }
  } catch {
    // cron_jobs table may not exist yet
  }
}
