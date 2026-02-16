import { registerTool } from "../registry";
import { getDb } from "../../db/connection";

let activeTopic: string | null = null;

export function registerTopicsTool() {
  registerTool({
    definition: {
      name: "topics",
      description:
        "Organize conversations into named topics or threads. Each topic scopes the conversation context so you can keep separate discussions organized (e.g. 'work project', 'trip planning'). Use this to create, switch between, list, archive, or check the current topic.",
      input_schema: {
        type: "object",
        properties: {
          action: {
            type: "string",
            enum: ["create", "switch", "list", "archive", "current"],
            description:
              "The action to perform: create a new topic, switch to an existing one, list all active topics, archive a topic, or check the current topic.",
          },
          name: {
            type: "string",
            description:
              "The topic name (for create, switch, and archive). Examples: 'work project', 'trip planning', 'recipe ideas'.",
          },
          description: {
            type: "string",
            description: "Optional description of the topic (for create).",
          },
        },
        required: ["action"],
      },
    },
    execute: async (input) => {
      const { action, name, description } = input as {
        action: string;
        name?: string;
        description?: string;
      };
      const db = getDb();

      switch (action) {
        case "create": {
          if (!name) {
            return "Error: 'name' is required to create a topic.";
          }
          db.prepare(
            `INSERT INTO conversation_topics (name, description) VALUES (?, ?)`
          ).run(name, description ?? null);
          return `Topic '${name}' created. Switch to it with action 'switch'.`;
        }

        case "switch": {
          if (!name) {
            return "Error: 'name' is required to switch topics.";
          }
          const existing = db
            .query<{ name: string }, [string]>(
              `SELECT name FROM conversation_topics WHERE name = ? AND status = 'active'`
            )
            .get(name);

          if (!existing) {
            db.prepare(
              `INSERT OR IGNORE INTO conversation_topics (name) VALUES (?)`
            ).run(name);
          }

          db.prepare(
            `UPDATE conversation_topics SET last_message_at = datetime('now') WHERE name = ?`
          ).run(name);
          activeTopic = name;
          return `Switched to topic: ${name}. Your conversation context is now scoped to this topic.`;
        }

        case "list": {
          const topics = db
            .query<
              {
                name: string;
                description: string | null;
                last_message_at: string;
              },
              []
            >(
              `SELECT name, description, last_message_at FROM conversation_topics WHERE status = 'active' ORDER BY last_message_at DESC`
            )
            .all();

          if (topics.length === 0) {
            return `No active topics yet. Create one with action 'create'.\n\nCurrent: ${activeTopic ?? "default"}`;
          }

          const lines = topics.map((t) => {
            const ago = formatTimeAgo(t.last_message_at);
            const desc = t.description ? ` — ${t.description}` : "";
            return `- ${t.name}${desc} (last used: ${ago})`;
          });

          return `Active topics:\n${lines.join("\n")}\n\nCurrent: ${activeTopic ?? "default"}`;
        }

        case "archive": {
          if (!name) {
            return "Error: 'name' is required to archive a topic.";
          }
          const result = db.prepare(
            `UPDATE conversation_topics SET status = 'archived' WHERE name = ? AND status = 'active'`
          ).run(name);
          if (result.changes === 0) {
            return `No active topic found with name '${name}'.`;
          }
          if (activeTopic === name) {
            activeTopic = null;
          }
          return `Topic '${name}' archived. It will no longer appear in your active topics list.`;
        }

        case "current": {
          if (!activeTopic) {
            return "default (no topic selected)";
          }
          return activeTopic;
        }

        default:
          return `Unknown action: ${action}. Use one of: create, switch, list, archive, current.`;
      }
    },
  });
}

/** Get the current active topic (used by router to determine session key). */
export function getActiveTopic(): string | null {
  return activeTopic;
}

/** Get the session ID for the current topic. */
export function getTopicSessionId(): string {
  if (!activeTopic) return "owner";
  const safe = activeTopic
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
  return `topic-${safe}`;
}

function formatTimeAgo(isoDate: string): string {
  const then = new Date(isoDate + "Z").getTime();
  const now = Date.now();
  const diffMs = now - then;

  const minutes = Math.floor(diffMs / 60_000);
  if (minutes < 1) return "just now";
  if (minutes < 60) return `${minutes} minute${minutes === 1 ? "" : "s"} ago`;

  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours} hour${hours === 1 ? "" : "s"} ago`;

  const days = Math.floor(hours / 24);
  if (days === 1) return "yesterday";
  if (days < 7) return `${days} days ago`;

  const weeks = Math.floor(days / 7);
  return `${weeks} week${weeks === 1 ? "" : "s"} ago`;
}
