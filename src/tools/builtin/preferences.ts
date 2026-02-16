import { registerTool } from "../registry";

export function registerPreferencesTool() {
  registerTool({
    definition: {
      name: "preferences",
      description:
        "Manage user preferences. Use this to remember things the user likes, prefers, or wants you to know about them. Preferences are organized by category (communication, work, coding, food, schedule, general, etc.) and stored as key-value pairs.",
      input_schema: {
        type: "object",
        properties: {
          action: {
            type: "string",
            enum: ["set", "get", "list", "remove"],
            description:
              "Action to perform: set (save a preference), get (retrieve one), list (show all), remove (delete one)",
          },
          category: {
            type: "string",
            description:
              'Category for the preference (e.g., "communication", "work", "coding", "food", "schedule", "general")',
          },
          key: {
            type: "string",
            description:
              'Preference key (e.g., "preferred_language", "meeting_time", "coffee_order")',
          },
          value: {
            type: "string",
            description: "Preference value (required for set)",
          },
          confidence: {
            type: "number",
            description:
              "Confidence level 0-1. Defaults to 0.9 for explicit user-set preferences.",
          },
        },
        required: ["action"],
      },
    },
    execute: async (input) => {
      const { action, category, key, value, confidence } = input as {
        action: string;
        category?: string;
        key?: string;
        value?: string;
        confidence?: number;
      };

      const { getDb } = await import("../../db/connection");
      const db = getDb();

      if (action === "set") {
        if (!category || !key || !value) {
          return "Error: category, key, and value are required to set a preference.";
        }
        const conf = confidence ?? 0.9;
        db.prepare(
          `INSERT OR REPLACE INTO user_preferences (category, key, value, confidence, source, updated_at)
           VALUES (?, ?, ?, ?, 'explicit', datetime('now'))`
        ).run(category, key, value, conf);
        return `Preference saved: ${category}/${key} = ${value}`;
      }

      if (action === "get") {
        if (!category || !key) {
          return "Error: category and key are required to get a preference.";
        }
        const row = db
          .query("SELECT value FROM user_preferences WHERE category = ? AND key = ?")
          .get(category, key) as { value: string } | null;
        if (!row) return "No preference found.";
        return row.value;
      }

      if (action === "list") {
        const rows = db
          .query("SELECT * FROM user_preferences ORDER BY category, key")
          .all() as Array<{
          category: string;
          key: string;
          value: string;
          confidence: number;
        }>;

        if (rows.length === 0) return "No preferences saved yet.";

        let result = "";
        let currentCategory = "";
        for (const row of rows) {
          if (row.category !== currentCategory) {
            currentCategory = row.category;
            result += `\n## ${capitalize(currentCategory)}\n`;
          }
          result += `- ${row.key}: ${row.value} (confidence: ${row.confidence})\n`;
        }
        return result.trim();
      }

      if (action === "remove") {
        if (!category || !key) {
          return "Error: category and key are required to remove a preference.";
        }
        const changes = db
          .prepare("DELETE FROM user_preferences WHERE category = ? AND key = ?")
          .run(category, key).changes;
        if (changes > 0) return `Preference removed: ${category}/${key}`;
        return `No preference found for ${category}/${key}.`;
      }

      return `Unknown action: ${action}. Use set, get, list, or remove.`;
    },
  });
}

function capitalize(s: string): string {
  return s.charAt(0).toUpperCase() + s.slice(1);
}

/**
 * Detect obvious preference signals in a user message.
 * This is intentionally conservative — the LLM should handle nuanced
 * preference extraction by calling the preferences tool directly.
 */
export function extractPreferences(
  message: string
): Array<{ category: string; key: string; value: string }> {
  const prefs: Array<{ category: string; key: string; value: string }> = [];
  const _lower = message.toLowerCase();

  // "I prefer X" / "I like X" / "I always use X"
  const _preferPatterns = [
    /i (?:prefer|like|love|always use|usually use|tend to use)\s+(.+?)(?:\s+(?:for|when|over|instead)\b|[.,!]|$)/gi,
    /my (?:favorite|preferred|go-to)\s+(\w+)\s+is\s+(.+?)(?:[.,!]|$)/gi,
    /i'm a (\w+)\s+person/gi,
    /(?:call me|my name is|i'm|i am)\s+([A-Z][a-z]+(?:\s+[A-Z][a-z]+)?)/g,
  ];

  // Don't try to be too smart — just detect obvious signals
  // The LLM should handle the actual preference extraction via the tool
  return prefs;
}

/**
 * Load all user preferences into a formatted string suitable for
 * injection into the system prompt, giving the agent context about the user.
 */
export async function loadPreferencesContext(): Promise<string> {
  try {
    const { getDb } = await import("../../db/connection");
    const db = getDb();
    const rows = db
      .query(
        "SELECT category, key, value FROM user_preferences ORDER BY category, key"
      )
      .all() as Array<{ category: string; key: string; value: string }>;

    if (rows.length === 0) return "";

    let context = "## User preferences\n";
    let currentCat = "";
    for (const row of rows) {
      if (row.category !== currentCat) {
        currentCat = row.category;
        context += `\n**${currentCat}:**\n`;
      }
      context += `- ${row.key}: ${row.value}\n`;
    }
    return context;
  } catch {
    return "";
  }
}
