import { connect, type Socket } from "net";
import * as tls from "tls";
import type { ChannelAdapter, InboundMessage } from "./adapter";
import type { MessageRouter } from "./router";
import { logger } from "../util/logger";

export interface EmailConfig {
  enabled: boolean;
  imap: {
    host: string;
    port: number;
    user: string;
    password: string;
    tls: boolean;
  };
  smtp: {
    host: string;
    port: number;
    user: string;
    password: string;
    tls: boolean;
  };
  pollIntervalSeconds: number;
  allowedSenders?: string[];
  fromName?: string;
}

// --- Minimal IMAP client ---

class ImapClient {
  private socket: Socket | tls.TLSSocket | null = null;
  private buffer = "";
  private tagCounter = 0;
  private pendingResolve: ((data: string) => void) | null = null;

  constructor(private config: EmailConfig["imap"]) {}

  async connect(): Promise<void> {
    return new Promise((resolve, reject) => {
      const onConnect = () => {
        this.readUntilReady().then(resolve).catch(reject);
      };

      if (this.config.tls) {
        this.socket = tls.connect(
          { host: this.config.host, port: this.config.port, rejectUnauthorized: true },
          onConnect
        );
      } else {
        this.socket = connect({ host: this.config.host, port: this.config.port }, onConnect);
      }

      const sock = this.socket!;
      sock.setEncoding("utf-8");
      sock.on("data", (data: string) => {
        this.buffer += data;
        if (this.pendingResolve) {
          const resolve = this.pendingResolve;
          this.pendingResolve = null;
          resolve(this.buffer);
          this.buffer = "";
        }
      });

      sock.on("error", (err) => {
        logger.warn("IMAP socket error", { error: err.message });
        reject(err);
      });

      sock.setTimeout(30000);
    });
  }

  private readUntilReady(): Promise<void> {
    return new Promise((resolve) => {
      // Wait for server greeting
      const check = () => {
        if (this.buffer.includes("\r\n")) {
          this.buffer = "";
          resolve();
        } else {
          this.pendingResolve = () => {
            this.buffer = "";
            resolve();
          };
        }
      };
      setTimeout(check, 100);
    });
  }

  private async sendCommand(command: string): Promise<string> {
    const tag = `A${++this.tagCounter}`;
    const fullCommand = `${tag} ${command}\r\n`;

    return new Promise((resolve, reject) => {
      this.buffer = "";
      const timeout = setTimeout(() => reject(new Error(`IMAP command timeout: ${command.split(" ")[0]}`)), 15000);

      const checkComplete = () => {
        // Look for tagged response (completion)
        if (this.buffer.includes(`${tag} OK`) || this.buffer.includes(`${tag} NO`) || this.buffer.includes(`${tag} BAD`)) {
          clearTimeout(timeout);
          const result = this.buffer;
          this.buffer = "";
          resolve(result);
        } else {
          this.pendingResolve = () => checkComplete();
        }
      };

      this.socket!.write(fullCommand, () => {
        setTimeout(checkComplete, 100);
      });
    });
  }

  async login(): Promise<void> {
    // Escape password properly
    const password = this.config.password.replace(/\\/g, "\\\\").replace(/"/g, '\\"');
    const result = await this.sendCommand(`LOGIN ${this.config.user} "${password}"`);
    if (result.includes("NO") || result.includes("BAD")) {
      throw new Error("IMAP login failed: " + result.split("\r\n")[0]);
    }
  }

  async selectInbox(): Promise<void> {
    await this.sendCommand("SELECT INBOX");
  }

  async searchUnseen(): Promise<number[]> {
    const result = await this.sendCommand("SEARCH UNSEEN");
    const match = result.match(/\* SEARCH ([\d\s]+)/);
    if (!match) return [];
    return match[1].trim().split(/\s+/).map(Number).filter(n => !isNaN(n));
  }

  async fetchMessage(uid: number): Promise<{ from: string; subject: string; body: string }> {
    const result = await this.sendCommand(`FETCH ${uid} (BODY[HEADER.FIELDS (FROM SUBJECT)] BODY[TEXT])`);

    let from = "";
    let subject = "";
    let body = "";

    // Parse From header
    const fromMatch = result.match(/From:\s*(.+?)(?:\r\n(?!\s)|$)/i);
    if (fromMatch) from = fromMatch[1].trim();

    // Parse Subject header
    const subjectMatch = result.match(/Subject:\s*(.+?)(?:\r\n(?!\s)|$)/i);
    if (subjectMatch) subject = subjectMatch[1].trim();

    // Parse body — everything after the headers section
    const bodyMatch = result.match(/\r\n\r\n([\s\S]*?)(?:\r\n\)|\r\nA\d+)/);
    if (bodyMatch) body = bodyMatch[1].trim();

    // Strip script/style blocks and all HTML tags
    body = body
      .replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, "")
      .replace(/<style\b[^<]*(?:(?!<\/style>)<[^<]*)*<\/style>/gi, "")
      .replace(/<[^>]+>/g, "")
      .trim();
    // Decode basic quoted-printable
    body = body.replace(/=\r?\n/g, "").replace(/=([0-9A-Fa-f]{2})/g, (_, hex) => String.fromCharCode(parseInt(hex, 16)));

    return { from, subject, body: body.slice(0, 10000) };
  }

  async markSeen(uid: number): Promise<void> {
    await this.sendCommand(`STORE ${uid} +FLAGS (\\Seen)`);
  }

  async logout(): Promise<void> {
    try {
      await this.sendCommand("LOGOUT");
    } catch {}
    this.socket?.destroy();
    this.socket = null;
  }

  destroy(): void {
    this.socket?.destroy();
    this.socket = null;
  }
}

// --- Minimal SMTP client ---

class SmtpClient {
  private socket: Socket | tls.TLSSocket | null = null;
  private buffer = "";

  constructor(private config: EmailConfig["smtp"], private fromName?: string) {}

  private encodeMimeHeader(value: string): string {
    const sanitized = value.replace(/[\r\n]+/g, " ").trim();
    if (!sanitized) return "";
    // RFC 2047 encoded-word for non-ASCII header values (emoji, accents, etc.).
    if (/^[\x00-\x7F]*$/.test(sanitized)) return sanitized;
    return `=?UTF-8?B?${Buffer.from(sanitized, "utf8").toString("base64")}?=`;
  }

  private toCrlfBody(body: string): string {
    const normalized = body.replace(/\r\n/g, "\n").replace(/\r/g, "\n");
    return normalized
      .split("\n")
      .map((line) => (line.startsWith(".") ? `.${line}` : line))
      .join("\r\n");
  }

  private async connectRaw(): Promise<Socket | tls.TLSSocket> {
    return new Promise((resolve, reject) => {
      if (this.config.tls && this.config.port === 465) {
        // Implicit TLS for port 465
        const socket = tls.connect(
          { host: this.config.host, port: this.config.port, rejectUnauthorized: true },
          () => resolve(socket)
        );
        socket.setEncoding("utf-8");
        socket.on("error", reject);
        socket.setTimeout(15000);
      } else {
        const socket = connect({ host: this.config.host, port: this.config.port }, () => resolve(socket));
        socket.setEncoding("utf-8");
        socket.on("error", reject);
        socket.setTimeout(15000);
      }
    });
  }

  private async readResponse(socket: Socket | tls.TLSSocket): Promise<string> {
    return new Promise((resolve, reject) => {
      const timeout = setTimeout(() => reject(new Error("SMTP read timeout")), 10000);
      let data = "";
      const onData = (chunk: string) => {
        data += chunk;
        // SMTP responses end with \r\n and the status line has a space after the code
        if (/^\d{3} /m.test(data)) {
          clearTimeout(timeout);
          socket.removeListener("data", onData);
          resolve(data);
        }
      };
      socket.on("data", onData);
    });
  }

  private async sendCmd(socket: Socket | tls.TLSSocket, cmd: string): Promise<string> {
    return new Promise((resolve, reject) => {
      socket.write(cmd + "\r\n", () => {
        this.readResponse(socket).then(resolve).catch(reject);
      });
    });
  }

  async sendEmail(to: string, subject: string, body: string, from?: string): Promise<void> {
    const rawSocket = await this.connectRaw();
    let socket: Socket | tls.TLSSocket = rawSocket;

    try {
      // Read greeting
      await this.readResponse(socket);

      // EHLO
      await this.sendCmd(socket, `EHLO zubo.local`);

      // STARTTLS if configured on port 587 (port 465 uses implicit TLS established in connectRaw)
      if (this.config.tls && this.config.port === 587) {
        const tlsResp = await this.sendCmd(socket, "STARTTLS");
        if (tlsResp.startsWith("220")) {
          socket = tls.connect({
            socket: rawSocket,
            host: this.config.host,
            rejectUnauthorized: true,
          });
          socket.setEncoding("utf-8");
          // Re-EHLO after TLS
          await this.sendCmd(socket, `EHLO zubo.local`);
        }
      }

      // AUTH LOGIN
      await this.sendCmd(socket, "AUTH LOGIN");
      await this.sendCmd(socket, Buffer.from(this.config.user).toString("base64"));
      const authResult = await this.sendCmd(socket, Buffer.from(this.config.password).toString("base64"));
      if (!authResult.startsWith("235")) {
        throw new Error("SMTP authentication failed: " + authResult.trim());
      }

      // MAIL FROM
      const fromAddr = from || this.config.user;
      await this.sendCmd(socket, `MAIL FROM:<${fromAddr}>`);

      // RCPT TO
      await this.sendCmd(socket, `RCPT TO:<${to}>`);

      // DATA
      await this.sendCmd(socket, "DATA");

      // Message content — write directly to socket, not via sendCmd
      const displayName = this.fromName || "Zubo";
      const encodedFromName = this.encodeMimeHeader(displayName);
      const encodedSubject = this.encodeMimeHeader(subject);
      const safeBody = this.toCrlfBody(body || "");
      const message = [
        `From: ${encodedFromName} <${fromAddr}>`,
        `To: ${to}`,
        `Subject: ${encodedSubject}`,
        `Date: ${new Date().toUTCString()}`,
        `MIME-Version: 1.0`,
        `Content-Type: text/plain; charset=utf-8`,
        `Content-Transfer-Encoding: 8bit`,
        ``,
        safeBody,
      ].join("\r\n");

      // Send body then terminator, wait for 250 OK
      await new Promise<void>((resolve, reject) => {
        socket.write(message + "\r\n.\r\n", () => {
          this.readResponse(socket).then((resp) => {
            if (resp.startsWith("250")) resolve();
            else reject(new Error("SMTP DATA rejected: " + resp.trim()));
          }).catch(reject);
        });
      });

      // QUIT
      try {
        await this.sendCmd(socket, "QUIT");
      } catch {}
    } finally {
      socket.destroy();
    }
  }
}

export async function sendSmtpEmail(
  config: EmailConfig["smtp"],
  to: string,
  subject: string,
  body: string,
  fromName?: string,
  from?: string,
): Promise<void> {
  const smtp = new SmtpClient(config, fromName);
  await smtp.sendEmail(to, subject, body, from);
}

// --- Email channel adapter ---

function extractEmail(fromHeader: string): string {
  const match = fromHeader.match(/<([^>]+)>/);
  if (match) return match[1].toLowerCase();
  // Bare email address
  if (fromHeader.includes("@")) return fromHeader.trim().toLowerCase();
  return fromHeader.toLowerCase();
}

export function createEmailAdapter(
  config: EmailConfig,
  router: MessageRouter
): ChannelAdapter {
  let pollTimer: ReturnType<typeof setInterval> | null = null;
  let polling = false;

  const smtp = new SmtpClient(config.smtp, config.fromName);

  async function pollInbox(): Promise<void> {
    if (polling) return;
    polling = true;

    const imap = new ImapClient(config.imap);

    try {
      await imap.connect();
      await imap.login();
      await imap.selectInbox();

      const unseenIds = await imap.searchUnseen();
      if (unseenIds.length === 0) {
        await imap.logout();
        polling = false;
        return;
      }

      logger.info(`Email: ${unseenIds.length} new message(s)`);

      for (const uid of unseenIds.slice(0, 10)) {
        try {
          const msg = await imap.fetchMessage(uid);
          const senderEmail = extractEmail(msg.from);

          // Check allowlist
          if (config.allowedSenders?.length) {
            const allowed = config.allowedSenders.map(s => s.toLowerCase());
            if (!allowed.includes(senderEmail)) {
              logger.info(`Email: skipping message from non-allowed sender: ${senderEmail}`);
              await imap.markSeen(uid);
              continue;
            }
          }

          // Build inbound message
          const text = msg.subject
            ? `[Email from ${msg.from}] Subject: ${msg.subject}\n\n${msg.body}`
            : `[Email from ${msg.from}]\n\n${msg.body}`;

          const inbound: InboundMessage = {
            channel: "email",
            userId: senderEmail,
            sessionKey: `email:${senderEmail}`,
            text,
          };

          // Route to agent
          await router.handleMessage(inbound, async (reply) => {
            // Send reply email
            const replySubject = msg.subject
              ? (msg.subject.startsWith("Re:") ? msg.subject : `Re: ${msg.subject}`)
              : "Re: your message";

            try {
              await smtp.sendEmail(senderEmail, replySubject, reply);
              logger.info(`Email: replied to ${senderEmail}`);
            } catch (err: any) {
              logger.error("Email: failed to send reply", { error: err.message, to: senderEmail });
            }
          });

          await imap.markSeen(uid);
        } catch (err: any) {
          logger.error(`Email: failed to process message ${uid}`, { error: err.message });
        }
      }

      await imap.logout();
    } catch (err: any) {
      logger.error("Email: poll failed", { error: err.message });
      imap.destroy();
    }

    polling = false;
  }

  return {
    channelName: "email",

    start() {
      logger.info(`Email channel starting (poll every ${config.pollIntervalSeconds}s)`);
      // Initial poll
      setTimeout(() => pollInbox(), 5000);
      // Recurring poll
      pollTimer = setInterval(() => pollInbox(), config.pollIntervalSeconds * 1000);
    },

    stop() {
      if (pollTimer) {
        clearInterval(pollTimer);
        pollTimer = null;
      }
      logger.info("Email channel stopped");
    },

    async sendMessage(sessionKey: string, text: string) {
      // Extract email from session key: "email:user@example.com"
      const parts = sessionKey.split(":");
      const to = parts.slice(1).join(":");
      if (!to || !to.includes("@")) {
        logger.warn("Email: cannot send — invalid session key", { sessionKey });
        return;
      }

      try {
        await smtp.sendEmail(to, "Message from Zubo", text);
        logger.info(`Email: sent proactive message to ${to}`);
      } catch (err: any) {
        logger.error("Email: failed to send proactive message", { error: err.message, to });
      }
    },
  };
}
