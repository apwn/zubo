import { getDb } from "../db/connection";
import { logger } from "../util/logger";

export interface SentMessageLogEntry {
  provider: string;
  recipient: string;
  subject: string;
  body?: string;
  attachments?: string[];
  status: "sent" | "failed";
  errorMessage?: string;
  externalId?: string;
}

export function logSentMessage(entry: SentMessageLogEntry): void {
  try {
    const db = getDb();
    const preview = (entry.body ?? "").slice(0, 500);
    const attachmentsJson = entry.attachments?.length ? JSON.stringify(entry.attachments) : null;
    db.prepare(
      `INSERT INTO sent_messages
       (provider, recipient, subject, body_preview, attachments_json, status, error_message, external_id)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`
    ).run(
      entry.provider,
      entry.recipient,
      entry.subject,
      preview || null,
      attachmentsJson,
      entry.status,
      entry.errorMessage ?? null,
      entry.externalId ?? null,
    );
  } catch (err: any) {
    logger.warn("Failed to log sent message", { error: err?.message ?? String(err) });
  }
}
