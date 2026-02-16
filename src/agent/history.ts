import { getDb } from "../db/connection";
import { logger } from "../util/logger";

/**
 * Record a message in conversation history.
 * Inserts into conversation_messages, updates thread message count,
 * and indexes content in the FTS5 search table.
 */
export function recordMessage(
  threadId: string,
  role: string,
  content: string,
  channel?: string
): void {
  try {
    const db = getDb();
    db.run(
      "INSERT INTO conversation_messages (thread_id, role, content, channel, timestamp) VALUES (?, ?, ?, ?, datetime('now'))",
      [threadId, role, content, channel ?? null]
    );
    db.run(
      "UPDATE threads SET message_count = message_count + 1, updated_at = datetime('now') WHERE id = ?",
      [threadId]
    );
    db.run(
      "INSERT INTO conversation_search (content, thread_id, role) VALUES (?, ?, ?)",
      [content, threadId, role]
    );
  } catch (err: any) {
    logger.error("Failed to record message", {
      threadId,
      role,
      error: err?.message ?? String(err),
    });
  }
}

/**
 * Full-text search across conversation history.
 * Sanitizes the query to prevent FTS5 operator injection,
 * then returns matching messages ranked by relevance.
 */
export function searchConversations(
  query: string,
  limit: number = 20
): { thread_id: string; role: string; content: string; channel: string | null; timestamp: string }[] {
  try {
    // Sanitize FTS5 input -- strip special operators to prevent query injection
    const sanitized = query
      .replace(/['"*()[\]{}:^~+\-!/\\]/g, " ")
      .replace(/\b(AND|OR|NOT|NEAR)\b/gi, "")
      .trim();
    const terms = sanitized.split(/\s+/).filter(Boolean);
    if (!terms.length) return [];
    const ftsQuery = terms.join(" OR ");

    const db = getDb();
    return db
      .query(
        `SELECT cs.thread_id, cs.role, cs.content, cm.channel, cm.timestamp
         FROM conversation_search cs
         JOIN conversation_messages cm
           ON cm.thread_id = cs.thread_id AND cm.content = cs.content
         WHERE conversation_search MATCH ?
         ORDER BY rank
         LIMIT ?`
      )
      .all(ftsQuery, limit) as any[];
  } catch (err: any) {
    logger.error("Failed to search conversations", {
      query,
      error: err?.message ?? String(err),
    });
    return [];
  }
}

/**
 * Retrieve aggregate statistics about conversation history.
 */
export function getConversationStats(): {
  totalConversations: number;
  totalMessages: number;
  messagesByChannel: { channel: string | null; count: number }[];
  recentActivity: { day: string; count: number }[];
} {
  try {
    const db = getDb();

    const totalConversations =
      (db.query("SELECT COUNT(*) as count FROM threads").get() as any)?.count ?? 0;

    const totalMessages =
      (db.query("SELECT COUNT(*) as count FROM conversation_messages").get() as any)?.count ?? 0;

    const messagesByChannel = db
      .query("SELECT channel, COUNT(*) as count FROM conversation_messages GROUP BY channel")
      .all() as { channel: string | null; count: number }[];

    const recentActivity = db
      .query(
        `SELECT date(timestamp) as day, COUNT(*) as count
         FROM conversation_messages
         WHERE timestamp >= datetime('now', '-7 days')
         GROUP BY date(timestamp)
         ORDER BY day`
      )
      .all() as { day: string; count: number }[];

    return { totalConversations, totalMessages, messagesByChannel, recentActivity };
  } catch (err: any) {
    logger.error("Failed to get conversation stats", {
      error: err?.message ?? String(err),
    });
    return {
      totalConversations: 0,
      totalMessages: 0,
      messagesByChannel: [],
      recentActivity: [],
    };
  }
}
