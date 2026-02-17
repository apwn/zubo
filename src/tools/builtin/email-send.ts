import { existsSync, readFileSync } from "fs";
import { resolve } from "path";
import { registerTool } from "../registry";
import { paths } from "../../config/paths";
import { getDb } from "../../db/connection";
import { sendSmtpEmail, type EmailConfig } from "../../channels/email";

function isValidEmail(value: string): boolean {
  const trimmed = value.trim();
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(trimmed);
}

function resolveAttachmentRef(ref: string): string | null {
  const trimmed = ref.trim();
  if (!trimmed) return null;
  if (trimmed.startsWith("upload:")) {
    const id = Number(trimmed.slice("upload:".length));
    if (!Number.isFinite(id) || id <= 0) return null;
    try {
      const db = getDb();
      const row = db.query("SELECT filename FROM uploads WHERE id = ?").get(id) as { filename: string } | null;
      if (!row?.filename) return null;
      return row.filename;
    } catch {
      return null;
    }
  }
  return trimmed;
}

function isAllowedAttachmentPath(filePath: string): boolean {
  const absolute = resolve(filePath);
  const roots = [resolve(process.cwd()), resolve(paths.uploads)];
  return roots.some((root) => absolute.startsWith(root + "/") || absolute === root);
}

export function registerEmailSendTool(): void {
  registerTool({
    definition: {
      name: "email_send",
      description:
        "Send an email using the configured SMTP account in channels.email.smtp. " +
        "Use this when the user asks to send or write an email to someone.",
      input_schema: {
        type: "object",
        properties: {
          to: { type: "string", description: "Recipient email address" },
          subject: { type: "string", description: "Email subject" },
          body: { type: "string", description: "Email body content" },
          attachments: {
            type: "array",
            items: { type: "string" },
            description:
              "Optional attachment references. Use absolute/relative file paths in workspace, or upload IDs via `upload:<id>`.",
          },
        },
        required: ["to", "subject", "body"],
      },
    },
    execute: async (input) => {
      const to = String(input.to ?? "").trim();
      const subject = String(input.subject ?? "").trim();
      const body = String(input.body ?? "");
      const attachmentRefs = Array.isArray(input.attachments)
        ? input.attachments.map((x) => String(x))
        : [];

      if (!to || !isValidEmail(to)) {
        return "Invalid recipient email address. Please provide a valid `to` address.";
      }
      if (!subject) return "Subject is required.";
      if (!body.trim()) return "Body is required.";

      let parsed: any;
      try {
        parsed = JSON.parse(readFileSync(paths.config, "utf-8"));
      } catch {
        return "Could not read config. Run `zubo setup` and configure Email first.";
      }

      const emailCfg = parsed?.channels?.email as EmailConfig | undefined;
      const smtpCfg = emailCfg?.smtp;
      if (!smtpCfg?.host || !smtpCfg?.user || !smtpCfg?.password) {
        return (
          "Email is not configured yet. Configure `channels.email.smtp` in Settings > Channels > Email " +
          "or run `zubo setup`."
        );
      }

      const attachments: string[] = [];
      for (const ref of attachmentRefs) {
        const resolvedRef = resolveAttachmentRef(ref);
        if (!resolvedRef) return `Invalid attachment reference: ${ref}`;
        const absolute = resolve(resolvedRef);
        if (!existsSync(absolute)) return `Attachment not found: ${ref}`;
        if (!isAllowedAttachmentPath(absolute)) {
          return `Attachment path is outside allowed roots (workspace/uploads): ${ref}`;
        }
        attachments.push(absolute);
      }

      try {
        await sendSmtpEmail(smtpCfg, to, subject, body, emailCfg?.fromName, undefined, attachments);
        return attachments.length
          ? `Email sent to ${to} with ${attachments.length} attachment(s).`
          : `Email sent to ${to} with subject "${subject}".`;
      } catch (err: any) {
        return `Failed to send email: ${err?.message ?? String(err)}`;
      }
    },
  });
}
