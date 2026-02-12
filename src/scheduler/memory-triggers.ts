import { Database } from "bun:sqlite";
import type { MessageRouter } from "../channels/router";
import type { LlmProvider } from "../llm/provider";
import { agentLoop } from "../agent/loop";
import { logger } from "../util/logger";

export interface MemoryTrigger {
  id: number;
  pattern: string;
  action: string;
  schedule: string;
  last_fired: string | null;
  enabled: number;
}

export async function checkMemoryTriggers(
  db: Database,
  router: MessageRouter,
  llm: LlmProvider
): Promise<void> {
  let triggers: MemoryTrigger[];
  try {
    triggers = db.query(
      "SELECT * FROM memory_triggers WHERE enabled = 1"
    ).all() as MemoryTrigger[];
  } catch {
    return; // Table may not exist
  }

  if (triggers.length === 0) return;

  const now = new Date();

  for (const trigger of triggers) {
    if (!shouldFire(trigger, now)) continue;

    logger.info(`Firing memory trigger: ${trigger.pattern}`);

    try {
      // Search memory for the pattern
      const { searchMemory } = await import("../memory/engine");
      const results = searchMemory(db, trigger.pattern, 3);

      if (results.length > 0) {
        const context = results.map((r) => r.content).join("\n");
        const task = `${trigger.action}\n\nRelevant context:\n${context}`;

        const result = await agentLoop(llm, "trigger", task, { maxRounds: 3 });

        if (result.reply && router.broadcastProactive) {
          await router.broadcastProactive(result.reply);
        }

        // Log
        try {
          db.prepare(
            "INSERT INTO proactive_log (type, message) VALUES ('trigger', ?)"
          ).run(`[${trigger.pattern}] ${result.reply.slice(0, 2000)}`);
        } catch {}
      }

      // Update last_fired
      db.prepare(
        "UPDATE memory_triggers SET last_fired = datetime('now') WHERE id = ?"
      ).run(trigger.id);

      // Disable if one-shot
      if (trigger.schedule === "once") {
        db.prepare(
          "UPDATE memory_triggers SET enabled = 0 WHERE id = ?"
        ).run(trigger.id);
      }
    } catch (err: any) {
      logger.error(`Trigger error (${trigger.pattern})`, { error: err.message });
    }
  }
}

function shouldFire(trigger: MemoryTrigger, now: Date): boolean {
  if (!trigger.last_fired) return true;

  const lastFired = new Date(trigger.last_fired);
  const diffMs = now.getTime() - lastFired.getTime();
  const diffHours = diffMs / 3_600_000;

  switch (trigger.schedule) {
    case "once":
      return !trigger.last_fired;
    case "daily":
      return diffHours >= 24;
    case "weekly":
      return diffHours >= 168;
    case "monthly":
      return diffHours >= 720;
    default:
      return diffHours >= 24;
  }
}
