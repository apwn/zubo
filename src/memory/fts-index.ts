import { Database } from "bun:sqlite";

export interface FtsResult {
  id: number;
  content: string;
  sourceFile: string;
  score: number;
}

/**
 * Full-text search using SQLite FTS5 with BM25 ranking.
 */
export function ftsSearch(
  db: Database,
  query: string,
  limit: number = 5
): FtsResult[] {
  // Escape FTS5 special characters
  const escaped = query.replace(/['"*()]/g, "");
  if (!escaped.trim()) return [];

  // Split into terms and join with OR for broader matching
  const terms = escaped.split(/\s+/).filter(Boolean);
  const ftsQuery = terms.join(" OR ");

  try {
    const rows = db
      .query(
        `SELECT mc.id, mc.content, mc.source_file,
                rank as score
         FROM memory_fts
         JOIN memory_chunks mc ON mc.id = memory_fts.rowid
         WHERE memory_fts MATCH ?
         ORDER BY rank
         LIMIT ?`
      )
      .all(ftsQuery, limit) as Array<{
      id: number;
      content: string;
      source_file: string;
      score: number;
    }>;

    // Normalize FTS scores (BM25 returns negative values, lower = better)
    const maxScore = rows.length > 0 ? Math.abs(rows[0].score) : 1;
    return rows.map((row) => ({
      id: row.id,
      content: row.content,
      sourceFile: row.source_file,
      score: maxScore > 0 ? Math.abs(row.score) / maxScore : 0,
    }));
  } catch {
    return [];
  }
}
