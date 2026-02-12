import { registerTool } from "../registry";
import { addCronJob, removeCronJob, listCronJobs } from "../../scheduler/cron";
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
        "Create a scheduled task that runs on a cron schedule. The task is a natural language instruction that the agent will execute at the scheduled time. Optionally assign to a specific sub-agent.",
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
              "Cron expression (e.g., '0 9 * * 1-5' for weekdays at 9am, '0 9 * * 1' for Mondays at 9am, '*/30 * * * *' for every 30 minutes)",
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
        addCronJob(db, name, schedule, task, router, config, agent, llm);
        let msg = `Scheduled task "${name}" created.\nSchedule: ${schedule}\nTask: ${task}`;
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
      name: "cron_list",
      description:
        "List all scheduled tasks with their status, schedule, and last run time.",
      input_schema: {
        type: "object",
        properties: {},
      },
    },
    execute: async () => {
      const jobs = listCronJobs(db);
      if (jobs.length === 0) return "No scheduled tasks found.";

      return jobs
        .map(
          (j) =>
            `- ${j.name} [${j.enabled ? "active" : "disabled"}]\n  Schedule: ${j.schedule}\n  Task: ${j.task}${j.agent ? `\n  Agent: ${j.agent}` : ""}\n  Last run: ${j.last_run ?? "never"}`
        )
        .join("\n\n");
    },
  });

  registerTool({
    definition: {
      name: "cron_delete",
      description: "Delete a scheduled task by name.",
      input_schema: {
        type: "object",
        properties: {
          name: {
            type: "string",
            description: "The name of the scheduled task to delete",
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
