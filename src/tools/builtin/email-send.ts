import { readFileSync } from "fs";
import { registerTool } from "../registry";
import { paths } from "../../config/paths";
import { sendSmtpEmail, type EmailConfig } from "../../channels/email";

function isValidEmail(value: string): boolean {
  const trimmed = value.trim();
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(trimmed);
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
        },
        required: ["to", "subject", "body"],
      },
    },
    execute: async (input) => {
      const to = String(input.to ?? "").trim();
      const subject = String(input.subject ?? "").trim();
      const body = String(input.body ?? "");

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

      try {
        await sendSmtpEmail(smtpCfg, to, subject, body, emailCfg?.fromName);
        return `Email sent to ${to} with subject "${subject}".`;
      } catch (err: any) {
        return `Failed to send email: ${err?.message ?? String(err)}`;
      }
    },
  });
}
