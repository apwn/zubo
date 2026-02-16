import { registerTool } from "../registry";
import { addCronJob, removeCronJob } from "../../scheduler/cron";
import { parseNaturalSchedule } from "../../scheduler/natural-cron";
import type { MessageRouter } from "../../channels/router";
import type { ZuboConfig } from "../../config/schema";
import type { LlmProvider } from "../../llm/provider";
import type { Database } from "bun:sqlite";

export function registerFollowUpsTool(
  db: Database,
  router: MessageRouter,
  config: ZuboConfig,
  llm?: LlmProvider
) {
  registerTool({
    definition: {
      name: "follow_ups",
      description:
        "Schedule, list, or cancel follow-up messages. Use this when you want to proactively check in with the user about something later — e.g., after they mention a dentist appointment, interview, or task they're working on. The follow-up fires as a proactive message at the scheduled time.",
      input_schema: {
        type: "object",
        properties: {
          action: {
            type: "string",
            enum: ["schedule", "list", "cancel"],
            description:
              "Action to perform: schedule (create a follow-up), list (show pending), cancel (remove one)",
          },
          context: {
            type: "string",
            description:
              'What the follow-up is about (for schedule). E.g., "dentist appointment", "job interview at Google"',
          },
          message: {
            type: "string",
            description:
              'The message to send when following up (for schedule). E.g., "Hey! How did the dentist appointment go?"',
          },
          delay: {
            type: "string",
            description:
              'When to follow up (for schedule). E.g., "in 2 hours", "tomorrow morning", "in 3 days"',
          },
          id: {
            type: "number",
            description: "Follow-up ID to cancel (for cancel)",
          },
        },
        required: ["action"],
      },
    },
    execute: async (input) => {
      const { action, context, message, delay, id } = input as {
        action: string;
        context?: string;
        message?: string;
        delay?: string;
        id?: number;
      };

      if (action === "schedule") {
        if (!context || !message || !delay) {
          return "Error: context, message, and delay are required to schedule a follow-up.";
        }

        // Parse the delay into a one-shot cron schedule
        const delayText = delay.toLowerCase().startsWith("in ")
          ? delay
          : `in ${delay}`;
        const parsed = parseNaturalSchedule(delayText);

        if (typeof parsed === "string" || !parsed.once) {
          return `Error: "${delay}" does not look like a one-shot delay. Use formats like "in 2 hours", "in 30 minutes", or "in 3 days".`;
        }

        const followUpAt = parsed.cron; // ISO 8601 string

        // Insert the follow-up record
        const result = db
          .prepare(
            "INSERT INTO follow_ups (context, message, follow_up_at) VALUES (?, ?, ?)"
          )
          .run(context, message, followUpAt);

        const followUpId = Number(result.lastInsertRowid);
        const cronName = `followup-${followUpId}`;

        // Create a one-shot cron job to fire the proactive message
        try {
          addCronJob(
            db,
            cronName,
            followUpAt,
            message,
            router,
            config,
            undefined,
            llm,
            true
          );
        } catch (err: any) {
          // Clean up the follow-up record if cron creation fails
          db.prepare("DELETE FROM follow_ups WHERE id = ?").run(followUpId);
          return `Error scheduling follow-up: ${err.message}`;
        }

        const fireDate = new Date(followUpAt);
        const fireTime = fireDate.toLocaleTimeString([], {
          hour: "2-digit",
          minute: "2-digit",
        });
        const fireDay = fireDate.toLocaleDateString([], {
          weekday: "short",
          month: "short",
          day: "numeric",
        });

        return `Follow-up scheduled for ${fireDay} at ${fireTime}: "${message}"`;
      }

      if (action === "list") {
        const rows = db
          .query(
            "SELECT * FROM follow_ups WHERE status = 'pending' ORDER BY follow_up_at"
          )
          .all() as Array<{
          id: number;
          context: string;
          message: string;
          follow_up_at: string;
        }>;

        if (rows.length === 0) return "No pending follow-ups.";

        return rows
          .map((row) => {
            const relative = formatRelativeTime(new Date(row.follow_up_at));
            return `${row.id}. ${row.context} — ${relative}\n   Message: "${row.message}"`;
          })
          .join("\n\n");
      }

      if (action === "cancel") {
        if (!id) {
          return "Error: id is required to cancel a follow-up.";
        }

        const row = db
          .query("SELECT * FROM follow_ups WHERE id = ? AND status = 'pending'")
          .get(id) as { id: number } | null;

        if (!row) {
          return `No pending follow-up found with ID ${id}.`;
        }

        db.prepare(
          "UPDATE follow_ups SET status = 'cancelled' WHERE id = ?"
        ).run(id);

        // Try to remove the corresponding cron job
        const cronName = `followup-${id}`;
        removeCronJob(db, cronName);

        return `Follow-up #${id} cancelled.`;
      }

      return `Unknown action: ${action}. Use schedule, list, or cancel.`;
    },
  });
}

/**
 * Format a future date as a human-readable relative time string.
 */
function formatRelativeTime(date: Date): string {
  const now = Date.now();
  const diffMs = date.getTime() - now;

  if (diffMs < 0) return "overdue";

  const minutes = Math.floor(diffMs / 60_000);
  const hours = Math.floor(diffMs / 3_600_000);
  const days = Math.floor(diffMs / 86_400_000);

  if (minutes < 1) return "any moment now";
  if (minutes < 60) return `in ${minutes} minute${minutes === 1 ? "" : "s"}`;
  if (hours < 24) return `in ${hours} hour${hours === 1 ? "" : "s"}`;
  return `in ${days} day${days === 1 ? "" : "s"}`;
}
