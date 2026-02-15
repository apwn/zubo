import { registerTool } from "../registry";
import { addCronJob, removeCronJob, listCronJobs } from "../../scheduler/cron";
import { parseNaturalSchedule } from "../../scheduler/natural-cron";
import type { ParsedSchedule } from "../../scheduler/natural-cron";
import type { MessageRouter } from "../../channels/router";
import type { ZuboConfig } from "../../config/schema";
import type { LlmProvider } from "../../llm/provider";
import type { Database } from "bun:sqlite";

export function registerCronTools(
  db: Database,
  router: MessageRouter,
  config: ZuboConfig,
  llm?: LlmProvider
) {
  registerTool({
    definition: {
      name: "cron_create",
      description:
        "Create a scheduled task that runs on a cron schedule. Schedule can be a cron expression (e.g. '0 9 * * 1-5') or natural language (e.g. 'every weekday at 9am', 'every 30 minutes', 'daily at noon'). The task is a natural language instruction that the agent will execute at the scheduled time. Optionally assign to a specific sub-agent.",
      input_schema: {
        type: "object",
        properties: {
          name: {
            type: "string",
            description:
              "A unique name for this task (e.g., 'morning-briefing', 'pr-review-reminder')",
          },
          schedule: {
            type: "string",
            description:
              "Cron expression (e.g., '0 9 * * 1-5') or natural language (e.g., 'every weekday at 9am', 'every monday and friday at noon', 'every 30 minutes', 'daily at 8:30am')",
          },
          task: {
            type: "string",
            description:
              "The task to perform, as a natural language instruction (e.g., 'Send a morning briefing with weather and calendar summary')",
          },
          agent: {
            type: "string",
            description:
              "Optional: name of a sub-agent to delegate this task to. The agent must be created with manage_agents first.",
          },
        },
        required: ["name", "schedule", "task"],
      },
    },
    execute: async (input) => {
      const { name, schedule, task, agent } = input as {
        name: string;
        schedule: string;
        task: string;
        agent?: string;
      };
      try {
        let cronExpr = schedule;
        let once = false;
        let naturalParseError = "";
        try {
          const parsed = parseNaturalSchedule(schedule);
          if (typeof parsed === "string") {
            cronExpr = parsed;
          } else {
            cronExpr = parsed.cron;
            once = parsed.once;
          }
        } catch (parseErr: any) {
          naturalParseError = parseErr.message;
          // Only fall through if it looks like raw cron (5 space-separated fields)
          if (!/^[\d*\/,\-]+(\s+[\d*\/,\-]+){4}$/.test(schedule.trim())) {
            throw new Error(naturalParseError);
          }
        }
        addCronJob(db, name, cronExpr, task, router, config, agent, llm, once);
        let msg = `Scheduled task "${name}" created.\nSchedule: ${cronExpr}`;
        if (cronExpr !== schedule) msg += ` (parsed from "${schedule}")`;
        if (once) msg += `\nType: one-shot (will auto-delete after firing)`;
        msg += `\nTask: ${task}`;
        if (agent) msg += `\nAgent: ${agent}`;
        return msg;
      } catch (err: any) {
        if (err.message?.includes("UNIQUE constraint")) {
          return `Error: A task named "${name}" already exists. Use a different name or delete the existing one first.`;
        }
        throw err;
      }
    },
  });

  registerTool({
    definition: {
      name: "reminder_set",
      description:
        'Set a one-time reminder that fires once after a delay, then auto-deletes itself. Use this when the user asks to be reminded, pinged back, or followed up on something after a period of time. Examples: "in 30 minutes", "in 2 hours", "in 1 hour and 30 minutes". The reminder message is sent as a proactive message to the user.',
      input_schema: {
        type: "object",
        properties: {
          name: {
            type: "string",
            description:
              "A short unique name for this reminder (e.g., 'marketing-followup', 'standup-reminder')",
          },
          delay: {
            type: "string",
            description:
              'How long from now to fire the reminder. Natural language like "in 30 minutes", "in 2 hours", "in 1 hour and 15 minutes".',
          },
          message: {
            type: "string",
            description:
              "The reminder message to send to the user when the timer fires (e.g., 'Hey! Have you worked on marketing yet?')",
          },
        },
        required: ["name", "delay", "message"],
      },
    },
    execute: async (input) => {
      const { name, delay, message } = input as {
        name: string;
        delay: string;
        message: string;
      };
      try {
        // Ensure the delay starts with "in" for the parser
        const delayText = delay.toLowerCase().startsWith("in ") ? delay : `in ${delay}`;
        const parsed = parseNaturalSchedule(delayText);

        if (typeof parsed === "string" || !parsed.once) {
          throw new Error(
            `"${delay}" does not look like a one-shot delay. Use formats like "in 30 minutes" or "in 2 hours".`
          );
        }

        addCronJob(db, name, parsed.cron, message, router, config, undefined, llm, true);

        // Calculate human-readable fire time from ISO string
        const fireDate = new Date(parsed.cron);
        const fireTime = fireDate.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });

        return `Reminder "${name}" set! I'll ping you at ${fireTime} with: "${message}"\nThis reminder will auto-delete after firing.`;
      } catch (err: any) {
        if (err.message?.includes("UNIQUE constraint")) {
          return `Error: A reminder named "${name}" already exists. Use a different name or delete the existing one with cron_delete first.`;
        }
        throw err;
      }
    },
  });

  registerTool({
    definition: {
      name: "cron_list",
      description:
        "List all scheduled tasks and reminders with their status, schedule, and last run time.",
      input_schema: {
        type: "object",
        properties: {},
      },
    },
    execute: async () => {
      const jobs = listCronJobs(db);
      if (jobs.length === 0) return "No scheduled tasks or reminders found.";

      return jobs
        .map(
          (j) =>
            `- ${j.name} [${j.enabled ? "active" : "disabled"}]${j.once ? " (one-shot)" : ""}\n  Schedule: ${j.schedule}\n  Task: ${j.task}${j.agent ? `\n  Agent: ${j.agent}` : ""}\n  Last run: ${j.last_run ?? "never"}`
        )
        .join("\n\n");
    },
  });

  registerTool({
    definition: {
      name: "cron_delete",
      description: "Delete a scheduled task or reminder by name.",
      input_schema: {
        type: "object",
        properties: {
          name: {
            type: "string",
            description: "The name of the scheduled task or reminder to delete",
          },
        },
        required: ["name"],
      },
    },
    execute: async (input) => {
      const { name } = input as { name: string };
      const removed = removeCronJob(db, name);
      if (removed) return `Scheduled task "${name}" has been deleted.`;
      return `No scheduled task found with name "${name}".`;
    },
  });
}
