import { Cron } from "croner";
import { connect, type Socket } from "net";
import * as tls from "tls";
import { readFileSync } from "fs";
import { getDb } from "../db/connection";
import { logger } from "../util/logger";
import { paths } from "../config/paths";
import { getRecentErrors } from "../util/error-buffer";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface DigestConfig {
  id: number;
  enabled: number;
  frequency: string;
  send_time: string;
  email_to: string;
  include_conversations: number;
  include_tool_usage: number;
  include_errors: number;
  include_scheduled_tasks: number;
  last_sent_at: string | null;
}

interface SmtpConfig {
  host: string;
  port: number;
  user: string;
  password: string;
  tls: boolean;
}

// ---------------------------------------------------------------------------
// Module-level state for scheduled job
// ---------------------------------------------------------------------------

let digestJob: Cron | null = null;

// ---------------------------------------------------------------------------
// Minimal SMTP helper (mirrors email.ts pattern, HTML-capable)
// ---------------------------------------------------------------------------

async function smtpReadResponse(socket: Socket | tls.TLSSocket): Promise<string> {
  return new Promise((resolve, reject) => {
    const timeout = setTimeout(() => reject(new Error("SMTP read timeout")), 10000);
    let data = "";
    const onData = (chunk: string) => {
      data += chunk;
      if (/^\d{3} /m.test(data)) {
        clearTimeout(timeout);
        socket.removeListener("data", onData);
        resolve(data);
      }
    };
    socket.on("data", onData);
  });
}

async function smtpSendCmd(socket: Socket | tls.TLSSocket, cmd: string): Promise<string> {
  return new Promise((resolve, reject) => {
    socket.write(cmd + "\r\n", () => {
      smtpReadResponse(socket).then(resolve).catch(reject);
    });
  });
}

async function sendHtmlEmail(
  smtpConfig: SmtpConfig,
  to: string,
  subject: string,
  html: string,
  fromName?: string
): Promise<void> {
  // Connect
  const rawSocket: Socket | tls.TLSSocket = await new Promise((resolve, reject) => {
    if (smtpConfig.tls && smtpConfig.port === 465) {
      const socket = tls.connect(
        { host: smtpConfig.host, port: smtpConfig.port, rejectUnauthorized: true },
        () => resolve(socket)
      );
      socket.setEncoding("utf-8");
      socket.on("error", reject);
      socket.setTimeout(15000);
    } else {
      const socket = connect(
        { host: smtpConfig.host, port: smtpConfig.port },
        () => resolve(socket)
      );
      socket.setEncoding("utf-8");
      socket.on("error", reject);
      socket.setTimeout(15000);
    }
  });

  let socket: Socket | tls.TLSSocket = rawSocket;

  try {
    // Read server greeting
    await smtpReadResponse(socket);

    // EHLO
    await smtpSendCmd(socket, "EHLO zubo.local");

    // STARTTLS for port 587
    if (smtpConfig.tls && smtpConfig.port === 587) {
      const tlsResp = await smtpSendCmd(socket, "STARTTLS");
      if (tlsResp.startsWith("220")) {
        socket = tls.connect({
          socket: rawSocket as Socket,
          host: smtpConfig.host,
          rejectUnauthorized: true,
        });
        socket.setEncoding("utf-8");
        // Re-EHLO after TLS upgrade
        await smtpSendCmd(socket, "EHLO zubo.local");
      }
    }

    // AUTH LOGIN
    await smtpSendCmd(socket, "AUTH LOGIN");
    await smtpSendCmd(socket, Buffer.from(smtpConfig.user).toString("base64"));
    const authResult = await smtpSendCmd(
      socket,
      Buffer.from(smtpConfig.password).toString("base64")
    );
    if (!authResult.startsWith("235")) {
      throw new Error("SMTP authentication failed: " + authResult.trim());
    }

    // MAIL FROM
    const fromAddr = smtpConfig.user;
    await smtpSendCmd(socket, `MAIL FROM:<${fromAddr}>`);

    // RCPT TO — support comma-separated recipients
    const recipients = to.split(",").map((r) => r.trim()).filter(Boolean);
    for (const rcpt of recipients) {
      await smtpSendCmd(socket, `RCPT TO:<${rcpt}>`);
    }

    // DATA
    await smtpSendCmd(socket, "DATA");

    // Build the MIME message with HTML content type
    const displayName = fromName || "Zubo";
    const message = [
      `From: ${displayName} <${fromAddr}>`,
      `To: ${recipients.join(", ")}`,
      `Subject: ${subject}`,
      `Date: ${new Date().toUTCString()}`,
      `MIME-Version: 1.0`,
      `Content-Type: text/html; charset=utf-8`,
      `Content-Transfer-Encoding: 8bit`,
      ``,
      html,
    ].join("\r\n");

    // Send body + terminator, wait for 250 OK
    await new Promise<void>((resolve, reject) => {
      socket.write(message + "\r\n.\r\n", () => {
        smtpReadResponse(socket)
          .then((resp) => {
            if (resp.startsWith("250")) resolve();
            else reject(new Error("SMTP DATA rejected: " + resp.trim()));
          })
          .catch(reject);
      });
    });

    // QUIT
    try {
      await smtpSendCmd(socket, "QUIT");
    } catch {}
  } finally {
    socket.destroy();
  }
}

// ---------------------------------------------------------------------------
// HTML generation helpers
// ---------------------------------------------------------------------------

function escapeHtml(text: string): string {
  return text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function formatTimestamp(ts: string): string {
  try {
    return new Date(ts).toLocaleString();
  } catch {
    return ts;
  }
}

// ---------------------------------------------------------------------------
// generateDigest
// ---------------------------------------------------------------------------

export function generateDigest(since: Date): string {
  const db = getDb();
  const sinceIso = since.toISOString();

  // Read digest config for section toggles
  let config: DigestConfig | null = null;
  try {
    config = db
      .query("SELECT * FROM email_digest_config WHERE id = 1")
      .get() as DigestConfig | null;
  } catch {
    // Table may not exist; include all sections by default
  }

  const includeConversations = config ? !!config.include_conversations : true;
  const includeToolUsage = config ? !!config.include_tool_usage : true;
  const includeErrors = config ? !!config.include_errors : true;
  const includeScheduledTasks = config ? !!config.include_scheduled_tasks : true;

  // --- Gather data ---

  // Conversations
  let conversations: Array<{
    thread_id: string;
    role: string;
    content: string;
    channel: string;
    timestamp: string;
  }> = [];
  if (includeConversations) {
    try {
      conversations = db
        .query(
          "SELECT thread_id, role, content, channel, timestamp FROM conversation_messages WHERE timestamp >= ? ORDER BY timestamp ASC"
        )
        .all(sinceIso) as typeof conversations;
    } catch {
      // table may not exist
    }
  }

  // Tool metrics
  let toolMetrics: Array<{
    tool_name: string;
    session_id: string;
    duration_ms: number;
    success: number;
    created_at: string;
  }> = [];
  if (includeToolUsage) {
    try {
      toolMetrics = db
        .query(
          "SELECT tool_name, session_id, duration_ms, success, created_at FROM tool_metrics WHERE created_at >= ? ORDER BY created_at ASC"
        )
        .all(sinceIso) as typeof toolMetrics;
    } catch {}
  }

  // Cron logs
  let cronLogs: Array<{
    job_id: number;
    status: string;
    output: string | null;
    error: string | null;
    started_at: string;
    finished_at: string | null;
  }> = [];
  if (includeScheduledTasks) {
    try {
      cronLogs = db
        .query(
          "SELECT job_id, status, output, error, started_at, finished_at FROM cron_logs WHERE started_at >= ? ORDER BY started_at ASC"
        )
        .all(sinceIso) as typeof cronLogs;
    } catch {}
  }

  // Errors from in-memory buffer
  const recentErrors = includeErrors ? getRecentErrors(20) : [];

  // --- Build HTML ---

  const sinceStr = since.toLocaleDateString("en-US", {
    weekday: "long",
    year: "numeric",
    month: "long",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });

  let html = `<!DOCTYPE html>
<html>
<head><meta charset="utf-8"></head>
<body style="margin:0;padding:0;background-color:#1a1a2e;color:#e0e0e0;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;">
<div style="max-width:680px;margin:0 auto;padding:24px;">

  <!-- Header -->
  <div style="text-align:center;padding:24px 0;border-bottom:1px solid #2a2a4a;">
    <h1 style="margin:0;font-size:28px;color:#a78bfa;">Zubo Digest</h1>
    <p style="margin:8px 0 0;font-size:14px;color:#8888aa;">Since ${escapeHtml(sinceStr)}</p>
  </div>
`;

  // --- Conversations section ---
  if (includeConversations) {
    const threadMap = new Map<string, typeof conversations>();
    for (const msg of conversations) {
      const tid = msg.thread_id || "unknown";
      if (!threadMap.has(tid)) threadMap.set(tid, []);
      threadMap.get(tid)!.push(msg);
    }

    html += `
  <!-- Conversations -->
  <div style="padding:20px 0;border-bottom:1px solid #2a2a4a;">
    <h2 style="margin:0 0 12px;font-size:20px;color:#a78bfa;">Conversations</h2>
`;

    if (conversations.length === 0) {
      html += `    <p style="color:#8888aa;font-style:italic;">No conversations in this period.</p>\n`;
    } else {
      html += `    <p style="color:#b0b0c0;margin:0 0 12px;">${conversations.length} message(s) across ${threadMap.size} thread(s)</p>\n`;

      for (const [threadId, msgs] of threadMap) {
        const channelLabel = msgs[0]?.channel || "unknown";
        html += `    <div style="background:#22223a;border-radius:8px;padding:12px;margin:8px 0;">
      <div style="font-size:13px;color:#8888aa;margin-bottom:6px;">Thread ${escapeHtml(threadId.slice(0, 12))}... &middot; ${escapeHtml(channelLabel)} &middot; ${msgs.length} msg(s)</div>\n`;

        // Show first and last messages as a summary
        const preview = msgs.slice(0, 3);
        for (const m of preview) {
          const roleColor = m.role === "assistant" ? "#a78bfa" : "#60a5fa";
          const contentPreview = m.content.length > 200
            ? m.content.slice(0, 200) + "..."
            : m.content;
          html += `      <div style="margin:4px 0;font-size:13px;">
        <span style="color:${roleColor};font-weight:600;">${escapeHtml(m.role)}</span>
        <span style="color:#999;font-size:11px;"> ${formatTimestamp(m.timestamp)}</span>
        <div style="color:#c0c0d0;margin-top:2px;">${escapeHtml(contentPreview)}</div>
      </div>\n`;
        }

        if (msgs.length > 3) {
          html += `      <div style="color:#8888aa;font-size:12px;margin-top:4px;">... and ${msgs.length - 3} more message(s)</div>\n`;
        }

        html += `    </div>\n`;
      }
    }

    html += `  </div>\n`;
  }

  // --- Tool Usage section ---
  if (includeToolUsage) {
    // Aggregate by tool name
    const toolAgg = new Map<string, { count: number; successes: number; totalMs: number }>();
    for (const tm of toolMetrics) {
      const existing = toolAgg.get(tm.tool_name) || { count: 0, successes: 0, totalMs: 0 };
      existing.count++;
      if (tm.success) existing.successes++;
      existing.totalMs += tm.duration_ms || 0;
      toolAgg.set(tm.tool_name, existing);
    }

    html += `
  <!-- Tool Usage -->
  <div style="padding:20px 0;border-bottom:1px solid #2a2a4a;">
    <h2 style="margin:0 0 12px;font-size:20px;color:#a78bfa;">Tool Usage</h2>
`;

    if (toolMetrics.length === 0) {
      html += `    <p style="color:#8888aa;font-style:italic;">No tool usage in this period.</p>\n`;
    } else {
      html += `    <table style="width:100%;border-collapse:collapse;font-size:13px;">
      <tr style="border-bottom:1px solid #2a2a4a;">
        <th style="text-align:left;padding:8px;color:#a78bfa;">Tool</th>
        <th style="text-align:right;padding:8px;color:#a78bfa;">Calls</th>
        <th style="text-align:right;padding:8px;color:#a78bfa;">Success</th>
        <th style="text-align:right;padding:8px;color:#a78bfa;">Avg (ms)</th>
      </tr>\n`;

      for (const [name, stats] of toolAgg) {
        const avgMs = stats.count > 0 ? Math.round(stats.totalMs / stats.count) : 0;
        const successRate = stats.count > 0
          ? Math.round((stats.successes / stats.count) * 100)
          : 0;
        const rateColor = successRate >= 90 ? "#4ade80" : successRate >= 70 ? "#facc15" : "#f87171";

        html += `      <tr style="border-bottom:1px solid #2a2a4a;">
        <td style="padding:8px;color:#c0c0d0;">${escapeHtml(name)}</td>
        <td style="padding:8px;text-align:right;color:#c0c0d0;">${stats.count}</td>
        <td style="padding:8px;text-align:right;color:${rateColor};">${successRate}%</td>
        <td style="padding:8px;text-align:right;color:#c0c0d0;">${avgMs}</td>
      </tr>\n`;
      }

      html += `    </table>\n`;
    }

    html += `  </div>\n`;
  }

  // --- Errors section ---
  if (includeErrors) {
    html += `
  <!-- Errors -->
  <div style="padding:20px 0;border-bottom:1px solid #2a2a4a;">
    <h2 style="margin:0 0 12px;font-size:20px;color:#a78bfa;">Recent Errors</h2>
`;

    if (recentErrors.length === 0) {
      html += `    <p style="color:#4ade80;font-style:italic;">No recent errors.</p>\n`;
    } else {
      for (const err of recentErrors) {
        html += `    <div style="background:#2a1a1a;border-left:3px solid #f87171;border-radius:4px;padding:10px 12px;margin:6px 0;">
      <div style="font-size:11px;color:#f87171;margin-bottom:4px;">${escapeHtml(err.source)} &middot; ${formatTimestamp(err.timestamp)}</div>
      <div style="font-size:13px;color:#e0c0c0;">${escapeHtml(err.message)}</div>
    </div>\n`;
      }
    }

    html += `  </div>\n`;
  }

  // --- Scheduled Tasks section ---
  if (includeScheduledTasks) {
    html += `
  <!-- Scheduled Tasks -->
  <div style="padding:20px 0;border-bottom:1px solid #2a2a4a;">
    <h2 style="margin:0 0 12px;font-size:20px;color:#a78bfa;">Scheduled Tasks</h2>
`;

    if (cronLogs.length === 0) {
      html += `    <p style="color:#8888aa;font-style:italic;">No scheduled task runs in this period.</p>\n`;
    } else {
      for (const log of cronLogs) {
        const statusColor =
          log.status === "success" ? "#4ade80" : log.status === "failed" ? "#f87171" : "#facc15";
        const statusIcon =
          log.status === "success" ? "&#10003;" : log.status === "failed" ? "&#10007;" : "&#9679;";

        html += `    <div style="background:#22223a;border-radius:8px;padding:10px 12px;margin:6px 0;">
      <div style="font-size:13px;">
        <span style="color:${statusColor};font-weight:600;">${statusIcon} ${escapeHtml(log.status)}</span>
        <span style="color:#8888aa;font-size:11px;"> Job #${log.job_id} &middot; ${formatTimestamp(log.started_at)}</span>
      </div>\n`;

        if (log.error) {
          html += `      <div style="color:#f87171;font-size:12px;margin-top:4px;">${escapeHtml(log.error)}</div>\n`;
        }
        if (log.output) {
          const outputPreview = log.output.length > 150
            ? log.output.slice(0, 150) + "..."
            : log.output;
          html += `      <div style="color:#b0b0c0;font-size:12px;margin-top:4px;">${escapeHtml(outputPreview)}</div>\n`;
        }

        html += `    </div>\n`;
      }
    }

    html += `  </div>\n`;
  }

  // --- Footer ---
  html += `
  <!-- Footer -->
  <div style="text-align:center;padding:20px 0;color:#666;">
    <p style="margin:0;font-size:12px;">Generated by Zubo &middot; ${escapeHtml(new Date().toISOString())}</p>
  </div>

</div>
</body>
</html>`;

  return html;
}

// ---------------------------------------------------------------------------
// sendDigest
// ---------------------------------------------------------------------------

export async function sendDigest(): Promise<void> {
  const db = getDb();

  // Read digest configuration
  let config: DigestConfig | null = null;
  try {
    config = db
      .query("SELECT * FROM email_digest_config WHERE id = 1")
      .get() as DigestConfig | null;
  } catch (err: any) {
    logger.error("Digest: failed to read config from DB", { error: err.message });
    return;
  }

  if (!config || !config.enabled || !config.email_to) {
    return;
  }

  // Calculate the "since" boundary based on frequency
  const now = new Date();
  let since: Date;
  if (config.frequency === "weekly") {
    since = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
  } else {
    // default to daily
    since = new Date(now.getTime() - 24 * 60 * 60 * 1000);
  }

  // Generate the HTML digest
  const html = generateDigest(since);

  // Read SMTP config from config.json
  let smtpConfig: SmtpConfig | null = null;
  let fromName: string | undefined;
  try {
    const raw = readFileSync(paths.config, "utf-8");
    const parsed = JSON.parse(raw);
    smtpConfig = parsed.channels?.email?.smtp as SmtpConfig | undefined ?? null;
    fromName = parsed.channels?.email?.fromName;
  } catch (err: any) {
    logger.error("Digest: failed to read SMTP config from config.json", {
      error: err.message,
    });
    return;
  }

  if (!smtpConfig || !smtpConfig.host) {
    logger.error("Digest: SMTP not configured in config.json");
    return;
  }

  // Build the subject line
  const frequencyLabel = config.frequency === "weekly" ? "Weekly" : "Daily";
  const dateLabel = now.toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
  const subject = `Zubo ${frequencyLabel} Digest - ${dateLabel}`;

  // Send the email
  try {
    await sendHtmlEmail(smtpConfig, config.email_to, subject, html, fromName);

    // Update last_sent_at
    try {
      db.prepare(
        "UPDATE email_digest_config SET last_sent_at = datetime('now') WHERE id = 1"
      ).run();
    } catch {}

    logger.info("Digest: sent successfully", { to: config.email_to, frequency: config.frequency });
  } catch (err: any) {
    logger.error("Digest: failed to send email", { error: err.message });
  }
}

// ---------------------------------------------------------------------------
// scheduleDigest
// ---------------------------------------------------------------------------

export function scheduleDigest(): void {
  const db = getDb();

  // Read config from DB
  let config: DigestConfig | null = null;
  try {
    config = db
      .query("SELECT * FROM email_digest_config WHERE id = 1")
      .get() as DigestConfig | null;
  } catch {
    return;
  }

  if (!config || !config.enabled) {
    return;
  }

  // Parse send_time (HH:MM format)
  const timeParts = (config.send_time || "09:00").split(":");
  const hours = parseInt(timeParts[0], 10) || 9;
  const minutes = parseInt(timeParts[1], 10) || 0;

  // Build cron pattern
  let cronPattern: string;
  if (config.frequency === "weekly") {
    // Every Monday at the specified time
    cronPattern = `${minutes} ${hours} * * 1`;
  } else {
    // Daily at the specified time
    cronPattern = `${minutes} ${hours} * * *`;
  }

  // Stop existing job if any
  if (digestJob) {
    digestJob.stop();
    digestJob = null;
  }

  try {
    digestJob = new Cron(cronPattern, async () => {
      logger.info("Digest: scheduled job firing");
      try {
        await sendDigest();
      } catch (err: any) {
        logger.error("Digest: scheduled send failed", { error: err.message });
      }
    });

    logger.info("Digest: scheduled", {
      pattern: cronPattern,
      frequency: config.frequency,
      sendTime: config.send_time,
    });
  } catch (err: any) {
    logger.error("Digest: failed to create cron job", { error: err.message });
  }
}

// ---------------------------------------------------------------------------
// unscheduleDigest
// ---------------------------------------------------------------------------

export function unscheduleDigest(): void {
  if (digestJob) {
    digestJob.stop();
    digestJob = null;
    logger.info("Digest: unscheduled");
  }
}
