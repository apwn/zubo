import { registerTool } from "../registry";
import { getDb } from "../../db/connection";

interface NoteRow {
  id: number;
  title: string;
  content: string;
  tags: string;
  pinned: number;
  created_at: string;
  updated_at: string;
}

export function registerNotesTool() {
  registerTool({
    definition: {
      name: "notes",
      description:
        "Manage the user's notes. Save, search, list, update, delete, or pin notes with tags and full-text search.",
      input_schema: {
        type: "object",
        properties: {
          action: {
            type: "string",
            enum: ["save", "search", "list", "update", "delete", "pin"],
            description: "The action to perform on notes.",
          },
          title: {
            type: "string",
            description: "Title of the note (for save).",
          },
          content: {
            type: "string",
            description: "Content of the note (for save/update).",
          },
          tags: {
            type: "string",
            description:
              "Comma-separated tags (for save/update). Example: 'work, ideas'.",
          },
          query: {
            type: "string",
            description: "Search query for full-text search (for search).",
          },
          id: {
            type: "number",
            description: "Note ID (for update/delete/pin).",
          },
          limit: {
            type: "number",
            description: "Maximum number of results to return (for list/search). Default: 10.",
          },
        },
        required: ["action"],
      },
    },
    execute: async (input) => {
      const db = getDb();
      const action = input.action as string;

      if (action === "save") {
        const title = input.title as string;
        const content = input.content as string;
        if (!title) return "Error: title is required to save a note.";
        if (!content) return "Error: content is required to save a note.";

        const tags = input.tags
          ? JSON.stringify(
              (input.tags as string).split(",").map((t) => t.trim()).filter((t) => t.length > 0)
            )
          : "[]";

        const result = db
          .prepare(
            "INSERT INTO notes (title, content, tags) VALUES (?, ?, ?)"
          )
          .run(title, content, tags);

        return `Note saved: #${result.lastInsertRowid} ${title}`;
      }

      if (action === "search") {
        const query = input.query as string;
        if (!query) return "Error: query is required for search.";

        const limit = (input.limit as number) || 10;

        const rows = db
          .prepare(
            `SELECT n.* FROM notes n
             JOIN notes_fts f ON n.id = f.rowid
             WHERE notes_fts MATCH ?
             ORDER BY rank
             LIMIT ?`
          )
          .all(query, limit) as NoteRow[];

        if (rows.length === 0) return `No notes found matching "${query}".`;

        const lines = rows.map((row) => formatNote(row));
        return `Search results (${rows.length} found):\n${lines.join("\n")}`;
      }

      if (action === "list") {
        const limit = (input.limit as number) || 10;

        const rows = db
          .prepare(
            "SELECT * FROM notes ORDER BY pinned DESC, updated_at DESC LIMIT ?"
          )
          .all(limit) as NoteRow[];

        if (rows.length === 0) return "No notes found.";

        const lines = rows.map((row) => formatNote(row));
        return `Notes (${rows.length} total):\n${lines.join("\n")}`;
      }

      if (action === "update") {
        const id = input.id as number;
        if (!id) return "Error: id is required to update a note.";

        const updates: string[] = [];
        const values: (string | null)[] = [];

        if (input.title) {
          updates.push("title = ?");
          values.push(input.title as string);
        }
        if (input.content) {
          updates.push("content = ?");
          values.push(input.content as string);
        }
        if (input.tags !== undefined) {
          updates.push("tags = ?");
          values.push(
            JSON.stringify(
              (input.tags as string).split(",").map((t) => t.trim()).filter((t) => t.length > 0)
            )
          );
        }

        if (updates.length === 0)
          return "Error: provide at least one field to update.";

        updates.push("updated_at = datetime('now')");
        values.push(String(id));

        const changes = db
          .prepare(`UPDATE notes SET ${updates.join(", ")} WHERE id = ?`)
          .run(...values);

        if (changes.changes === 0) return `No note found with id #${id}.`;
        return `Updated note #${id}.`;
      }

      if (action === "delete") {
        const id = input.id as number;
        if (!id) return "Error: id is required to delete a note.";

        const changes = db
          .prepare("DELETE FROM notes WHERE id = ?")
          .run(id);

        if (changes.changes === 0) return `No note found with id #${id}.`;
        return `Deleted note #${id}.`;
      }

      if (action === "pin") {
        const id = input.id as number;
        if (!id) return "Error: id is required to pin/unpin a note.";

        const changes = db
          .prepare("UPDATE notes SET pinned = NOT pinned WHERE id = ?")
          .run(id);

        if (changes.changes === 0) return `No note found with id #${id}.`;

        const row = db
          .prepare("SELECT pinned FROM notes WHERE id = ?")
          .get(id) as { pinned: number } | null;

        const state = row?.pinned ? "pinned" : "unpinned";
        return `Note #${id} is now ${state}.`;
      }

      return `Unknown action: ${action}. Use save, search, list, update, delete, or pin.`;
    },
  });
}

function formatNote(row: NoteRow): string {
  const pin = row.pinned ? "📌 " : "";
  const preview =
    row.content.length > 80
      ? row.content.slice(0, 80) + "..."
      : row.content;
  let line = `${pin}#${row.id} ${row.title}`;

  if (row.tags && row.tags !== "[]") {
    const tagList = JSON.parse(row.tags) as string[];
    if (tagList.length > 0) line += ` [${tagList.join(", ")}]`;
  }

  line += ` — ${preview}`;
  return line;
}
