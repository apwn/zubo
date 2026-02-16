import { registerTool } from "../registry";
import { getDb } from "../../db/connection";

export function registerMemoryPruneTool() {
  registerTool({
    definition: {
      name: "memory_prune",
      description:
        "Manage and clean up persistent memory. Delete specific chunks, remove duplicates, purge old entries, or view memory statistics. Use this to keep memory lean and relevant.",
      input_schema: {
        type: "object",
        properties: {
          action: {
            type: "string",
            enum: [
              "delete_by_id",
              "delete_by_keyword",
              "delete_older_than",
              "delete_duplicates",
              "stats",
            ],
            description:
              "The pruning action to perform. " +
              "delete_by_id: remove a specific chunk by ID. " +
              "delete_by_keyword: remove all chunks containing a keyword. " +
              "delete_older_than: remove chunks older than N days. " +
              "delete_duplicates: find and remove near-duplicate chunks. " +
              "stats: show memory statistics.",
          },
          id: {
            type: "number",
            description: "The chunk ID to delete (required for delete_by_id).",
          },
          keyword: {
            type: "string",
            description:
              "Keyword to match against chunk content (required for delete_by_keyword). Case-insensitive.",
          },
          days: {
            type: "number",
            description:
              "Delete chunks older than this many days (required for delete_older_than).",
          },
        },
        required: ["action"],
      },
    },
    execute: async (input) => {
      const action = input.action as string;
      const db = getDb();

      switch (action) {
        case "delete_by_id": {
          const id = input.id as number | undefined;
          if (id == null) {
            return "Error: 'id' is required for delete_by_id.";
          }

          const existing = db
            .query("SELECT id, content FROM memory_chunks WHERE id = ?")
            .get(id) as { id: number; content: string } | null;

          if (!existing) {
            return `No memory chunk found with ID ${id}.`;
          }

          db.prepare("DELETE FROM memory_chunks WHERE id = ?").run(id);
          return `Deleted memory chunk #${id}: "${existing.content.slice(0, 80)}..."`;
        }

        case "delete_by_keyword": {
          const keyword = input.keyword as string | undefined;
          if (!keyword) {
            return "Error: 'keyword' is required for delete_by_keyword.";
          }

          const pattern = `%${keyword}%`;
          const matches = db
            .query(
              "SELECT id, content FROM memory_chunks WHERE content LIKE ? COLLATE NOCASE"
            )
            .all(pattern) as Array<{ id: number; content: string }>;

          if (matches.length === 0) {
            return `No memory chunks found containing "${keyword}".`;
          }

          db.prepare(
            "DELETE FROM memory_chunks WHERE content LIKE ? COLLATE NOCASE"
          ).run(pattern);

          const preview = matches
            .slice(0, 5)
            .map((m) => `  - #${m.id}: "${m.content.slice(0, 60)}..."`)
            .join("\n");
          const extra =
            matches.length > 5
              ? `\n  ... and ${matches.length - 5} more`
              : "";

          return `Deleted ${matches.length} chunk(s) containing "${keyword}":\n${preview}${extra}`;
        }

        case "delete_older_than": {
          const days = input.days as number | undefined;
          if (days == null || days <= 0) {
            return "Error: 'days' must be a positive number for delete_older_than.";
          }

          const cutoff = new Date();
          cutoff.setDate(cutoff.getDate() - days);
          const cutoffStr = cutoff.toISOString().replace("T", " ").slice(0, 19);

          const count = db
            .query(
              "SELECT COUNT(*) as c FROM memory_chunks WHERE created_at < ?"
            )
            .get(cutoffStr) as { c: number } | null;

          const total = count?.c ?? 0;
          if (total === 0) {
            return `No memory chunks older than ${days} day(s).`;
          }

          db.prepare("DELETE FROM memory_chunks WHERE created_at < ?").run(
            cutoffStr
          );

          return `Deleted ${total} memory chunk(s) older than ${days} day(s) (before ${cutoffStr}).`;
        }

        case "delete_duplicates": {
          // Find near-duplicates: chunks with identical content (exact match)
          const dupes = db
            .query(
              `SELECT content, COUNT(*) as cnt, GROUP_CONCAT(id) as ids
               FROM memory_chunks
               GROUP BY content
               HAVING cnt > 1`
            )
            .all() as Array<{
            content: string;
            cnt: number;
            ids: string;
          }>;

          if (dupes.length === 0) {
            return "No duplicate memory chunks found.";
          }

          let totalRemoved = 0;

          for (const dupe of dupes) {
            const idList = dupe.ids
              .split(",")
              .map((s) => parseInt(s, 10))
              .sort((a, b) => a - b);
            // Keep the oldest (lowest ID), delete the rest
            const toDelete = idList.slice(1);
            if (toDelete.length > 0) {
              const placeholders = toDelete.map(() => "?").join(",");
              db.prepare(
                `DELETE FROM memory_chunks WHERE id IN (${placeholders})`
              ).run(...toDelete);
              totalRemoved += toDelete.length;
            }
          }

          const preview = dupes
            .slice(0, 5)
            .map(
              (d) =>
                `  - "${d.content.slice(0, 60)}..." (${d.cnt} copies, kept 1)`
            )
            .join("\n");
          const extra =
            dupes.length > 5
              ? `\n  ... and ${dupes.length - 5} more groups`
              : "";

          return `Removed ${totalRemoved} duplicate chunk(s) across ${dupes.length} group(s):\n${preview}${extra}`;
        }

        case "stats": {
          const stats = db
            .query(
              `SELECT
                COUNT(*) as total,
                MIN(created_at) as oldest,
                MAX(created_at) as newest,
                SUM(LENGTH(content)) as total_size
               FROM memory_chunks`
            )
            .get() as {
            total: number;
            oldest: string | null;
            newest: string | null;
            total_size: number | null;
          } | null;

          if (!stats || stats.total === 0) {
            return "Memory is empty. No chunks stored.";
          }

          const sizeKb = ((stats.total_size ?? 0) / 1024).toFixed(1);

          return (
            `Memory statistics:\n` +
            `  Total chunks: ${stats.total}\n` +
            `  Oldest: ${stats.oldest ?? "unknown"}\n` +
            `  Newest: ${stats.newest ?? "unknown"}\n` +
            `  Total content size: ${sizeKb} KB`
          );
        }

        default:
          return `Unknown action: "${action}". Use one of: delete_by_id, delete_by_keyword, delete_older_than, delete_duplicates, stats.`;
      }
    },
  });
}
