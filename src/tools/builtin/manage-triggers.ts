import { registerTool } from "../registry";
import { getDb } from "../../db/connection";

export function registerManageTriggersTool() {
  registerTool({
    definition: {
      name: "manage_triggers",
      description:
        "Create, list, and remove proactive memory triggers. Triggers fire based on memory patterns and schedule.",
      input_schema: {
        type: "object",
        properties: {
          action: {
            type: "string",
            enum: ["create", "list", "remove"],
            description: "Action to perform",
          },
          pattern: {
            type: "string",
            description: "Memory search pattern that triggers the action",
          },
          trigger_action: {
            type: "string",
            description: "What to do when the trigger fires (task for the agent)",
          },
          schedule: {
            type: "string",
            enum: ["once", "daily", "weekly", "monthly"],
            description: "How often to check/fire (default: once)",
          },
          trigger_id: {
            type: "number",
            description: "Trigger ID (for remove)",
          },
        },
        required: ["action"],
      },
    },
    async execute(input) {
      const action = input.action as string;
      const db = getDb();

      switch (action) {
        case "list": {
          try {
            const triggers = db.query(
              "SELECT * FROM memory_triggers ORDER BY id"
            ).all();
            return JSON.stringify(triggers);
          } catch {
            return JSON.stringify({ error: "Triggers table not available" });
          }
        }

        case "create": {
          const pattern = input.pattern as string;
          const triggerAction = input.trigger_action as string;
          const schedule = (input.schedule as string) ?? "once";

          if (!pattern) return JSON.stringify({ error: "pattern is required" });
          if (!triggerAction) return JSON.stringify({ error: "trigger_action is required" });

          try {
            const result = db.prepare(
              "INSERT INTO memory_triggers (pattern, action, schedule) VALUES (?, ?, ?)"
            ).run(pattern, triggerAction, schedule);
            return JSON.stringify({
              created: true,
              id: Number(result.lastInsertRowid),
              pattern,
              schedule,
            });
          } catch (err: any) {
            return JSON.stringify({ error: err.message });
          }
        }

        case "remove": {
          const triggerId = input.trigger_id as number;
          if (!triggerId) return JSON.stringify({ error: "trigger_id is required" });
          try {
            db.prepare("DELETE FROM memory_triggers WHERE id = ?").run(triggerId);
            return JSON.stringify({ removed: true, id: triggerId });
          } catch (err: any) {
            return JSON.stringify({ error: err.message });
          }
        }

        default:
          return JSON.stringify({ error: `Unknown action: ${action}` });
      }
    },
  });
}
