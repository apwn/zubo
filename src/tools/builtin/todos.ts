import { registerTool } from "../registry";
import { getDb } from "../../db/connection";

function parseDate(input: string): string {
  const now = new Date();
  const lower = input.toLowerCase().trim();

  if (lower === "today") return now.toISOString().split("T")[0];

  if (lower === "tomorrow") {
    now.setDate(now.getDate() + 1);
    return now.toISOString().split("T")[0];
  }

  if (lower === "next week") {
    now.setDate(now.getDate() + 7);
    return now.toISOString().split("T")[0];
  }

  const days = [
    "sunday",
    "monday",
    "tuesday",
    "wednesday",
    "thursday",
    "friday",
    "saturday",
  ];

  for (let i = 0; i < days.length; i++) {
    if (lower.includes(days[i])) {
      const current = now.getDay();
      let diff = i - current;
      if (diff <= 0) diff += 7;
      if (lower.includes("next")) diff += 7;
      now.setDate(now.getDate() + diff);
      return now.toISOString().split("T")[0];
    }
  }

  const parsed = new Date(input);
  if (!isNaN(parsed.getTime())) return parsed.toISOString().split("T")[0];

  return input;
}

function formatDueDate(dueDate: string | null): string {
  if (!dueDate) return "";

  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const due = new Date(dueDate + "T00:00:00");
  const diffDays = Math.round(
    (due.getTime() - today.getTime()) / (1000 * 60 * 60 * 24)
  );

  if (diffDays < 0) return `overdue by ${Math.abs(diffDays)}d`;
  if (diffDays === 0) return "today";
  if (diffDays === 1) return "tomorrow";
  if (diffDays <= 7) return `in ${diffDays} days`;
  return dueDate;
}

interface TodoRow {
  id: number;
  title: string;
  description: string | null;
  priority: string;
  status: string;
  due_date: string | null;
  tags: string;
  created_at: string;
  completed_at: string | null;
}

export function registerTodosTool() {
  registerTool({
    definition: {
      name: "todos",
      description:
        "Manage the user's to-do list. Add, list, complete, remove, or update tasks with priorities, due dates, and tags.",
      input_schema: {
        type: "object",
        properties: {
          action: {
            type: "string",
            enum: ["add", "list", "complete", "remove", "update"],
            description: "The action to perform on the todo list.",
          },
          title: {
            type: "string",
            description: "Title of the todo item (for add).",
          },
          description: {
            type: "string",
            description: "Optional description (for add/update).",
          },
          priority: {
            type: "string",
            enum: ["low", "medium", "high", "urgent"],
            description: "Priority level (for add/update).",
          },
          due_date: {
            type: "string",
            description:
              'Due date — natural language like "tomorrow", "next friday", or an ISO date (for add/update).',
          },
          tags: {
            type: "string",
            description:
              "Comma-separated tags (for add/update). Example: 'work, urgent'.",
          },
          id: {
            type: "number",
            description: "Todo ID (for complete/remove/update).",
          },
          filter: {
            type: "string",
            description:
              'Filter for list action: "all", "pending", "done", "urgent", "overdue". Defaults to "pending".',
          },
        },
        required: ["action"],
      },
    },
    execute: async (input) => {
      const db = getDb();
      const action = input.action as string;

      if (action === "add") {
        const title = input.title as string;
        if (!title) return "Error: title is required to add a todo.";

        const priority = (input.priority as string) || "medium";
        const description = (input.description as string) || null;
        const tags = input.tags
          ? JSON.stringify(
              (input.tags as string).split(",").map((t) => t.trim()).filter((t) => t.length > 0)
            )
          : "[]";
        const dueDate = input.due_date
          ? parseDate(input.due_date as string)
          : null;

        const result = db
          .prepare(
            "INSERT INTO todos (title, description, priority, due_date, tags) VALUES (?, ?, ?, ?, ?)"
          )
          .run(title, description, priority, dueDate, tags);

        let msg = `Added: #${result.lastInsertRowid} ${title} [${priority}]`;
        if (dueDate) msg += ` due: ${formatDueDate(dueDate)}`;
        return msg;
      }

      if (action === "list") {
        const filter = (input.filter as string) || "pending";

        let query = "SELECT * FROM todos";
        const params: string[] = [];

        if (filter === "pending") {
          query += " WHERE status = 'pending'";
        } else if (filter === "done") {
          query += " WHERE status = 'done'";
        } else if (filter === "urgent") {
          query += " WHERE priority = 'urgent' AND status = 'pending'";
        } else if (filter === "overdue") {
          query +=
            " WHERE due_date < date('now') AND status = 'pending' AND due_date IS NOT NULL";
        }
        // "all" has no WHERE clause

        query +=
          " ORDER BY CASE priority WHEN 'urgent' THEN 0 WHEN 'high' THEN 1 WHEN 'medium' THEN 2 WHEN 'low' THEN 3 END, due_date ASC NULLS LAST";

        const rows = db.prepare(query).all(...params) as TodoRow[];

        if (rows.length === 0) return `No ${filter} todos found.`;

        const lines = rows.map((row) => {
          const check = row.status === "done" ? "☑" : "☐";
          let line = `${check} #${row.id} ${row.title} [${row.priority}]`;
          if (row.due_date) line += ` due: ${formatDueDate(row.due_date)}`;
          if (row.tags && row.tags !== "[]") {
            const tagList = JSON.parse(row.tags) as string[];
            if (tagList.length > 0) line += ` {${tagList.join(", ")}}`;
          }
          if (row.status === "done") line += " [done]";
          return line;
        });

        return `Todos (${filter} — ${rows.length} items):\n${lines.join("\n")}`;
      }

      if (action === "complete") {
        const id = input.id as number;
        if (!id) return "Error: id is required to complete a todo.";

        const changes = db
          .prepare(
            "UPDATE todos SET status = 'done', completed_at = datetime('now') WHERE id = ?"
          )
          .run(id);

        if (changes.changes === 0) return `No todo found with id #${id}.`;
        return `Completed todo #${id}.`;
      }

      if (action === "remove") {
        const id = input.id as number;
        if (!id) return "Error: id is required to remove a todo.";

        const changes = db
          .prepare("DELETE FROM todos WHERE id = ?")
          .run(id);

        if (changes.changes === 0) return `No todo found with id #${id}.`;
        return `Removed todo #${id}.`;
      }

      if (action === "update") {
        const id = input.id as number;
        if (!id) return "Error: id is required to update a todo.";

        const updates: string[] = [];
        const values: (string | null)[] = [];

        if (input.title) {
          updates.push("title = ?");
          values.push(input.title as string);
        }
        if (input.description !== undefined) {
          updates.push("description = ?");
          values.push((input.description as string) || null);
        }
        if (input.priority) {
          updates.push("priority = ?");
          values.push(input.priority as string);
        }
        if (input.due_date) {
          updates.push("due_date = ?");
          values.push(parseDate(input.due_date as string));
        }
        if (input.tags) {
          updates.push("tags = ?");
          values.push(
            JSON.stringify(
              (input.tags as string).split(",").map((t) => t.trim()).filter((t) => t.length > 0)
            )
          );
        }

        if (updates.length === 0)
          return "Error: provide at least one field to update.";

        values.push(String(id));

        const changes = db
          .prepare(`UPDATE todos SET ${updates.join(", ")} WHERE id = ?`)
          .run(...values);

        if (changes.changes === 0) return `No todo found with id #${id}.`;
        return `Updated todo #${id}.`;
      }

      return `Unknown action: ${action}. Use add, list, complete, remove, or update.`;
    },
  });
}
