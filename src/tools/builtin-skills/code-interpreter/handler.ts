import { mkdirSync, writeFileSync, unlinkSync } from "fs";
import { join } from "path";
import { homedir } from "os";

const DANGEROUS_PATTERNS = [
  /\brm\s+(-[a-zA-Z]*)?.*\s+\/\s*$/,
  /\bmkfs\b/,
  /\bdd\s+.*of=\/dev\//,
  /\bshutdown\b/,
  /\breboot\b/,
  /\bkill\s+(-9\s+)?-1\b/,
  /\bchmod\s+0{3}\s+\//,
  /\bfind\s+\/\s+.*-delete\b/,
  /\bos\.system\s*\(\s*["'].*rm\s+-rf/,
  /\bsubprocess\..*\(\s*["'].*rm\s+-rf/,
  /\bimport\s+subprocess.*Popen\s*\(\s*\[["']rm/,
  /child_process/,
  /\brequire\s*\(\s*["']child_process/,
  /Bun\.spawn|Deno\.run/,
];

export default async function (input: Record<string, unknown>): Promise<string> {
  const code = input.code as string;
  const language = input.language as string;

  if (!code || !language) {
    throw new Error("Both 'code' and 'language' are required.");
  }

  if (!["python", "javascript", "typescript"].includes(language)) {
    throw new Error(`Unsupported language: "${language}". Use python, javascript, or typescript.`);
  }

  if (code.length > 50000) {
    throw new Error("Code too long (max 50,000 characters).");
  }

  // Block dangerous patterns
  for (const pattern of DANGEROUS_PATTERNS) {
    if (pattern.test(code)) {
      throw new Error("Blocked: this code contains potentially dangerous operations.");
    }
  }

  // Read config for timeout/output limits
  const timeout = 30000;
  const maxStdout = 50000;
  const maxStderr = 10000;

  // Write code to temp file
  const tmpDir = join(homedir(), ".zubo", "tmp", "code-interpreter");
  mkdirSync(tmpDir, { recursive: true });

  const ext = language === "python" ? ".py" : language === "typescript" ? ".ts" : ".js";
  const tmpFile = join(tmpDir, `exec_${Date.now()}_${Math.random().toString(36).slice(2)}${ext}`);
  writeFileSync(tmpFile, code);

  try {
    const cmd =
      language === "python"
        ? ["python3", tmpFile]
        : ["bun", "run", tmpFile];

    const startTime = Date.now();
    const proc = Bun.spawn(cmd, {
      stdout: "pipe",
      stderr: "pipe",
      env: {
        HOME: process.env.HOME ?? "",
        PATH: process.env.PATH ?? "/usr/local/bin:/usr/bin:/bin",
        LANG: process.env.LANG ?? "en_US.UTF-8",
      },
      cwd: tmpDir,
    });

    let timedOut = false;
    const timer = setTimeout(() => {
      timedOut = true;
      try {
        proc.kill(9);
      } catch {}
    }, timeout);

    const [stdout, stderr] = await Promise.all([
      new Response(proc.stdout).text(),
      new Response(proc.stderr).text(),
    ]);
    const exitCode = await proc.exited;
    clearTimeout(timer);

    const executionTime = Date.now() - startTime;

    return JSON.stringify({
      exitCode,
      timedOut,
      executionTime,
      stdout: stdout.length > maxStdout ? stdout.slice(0, maxStdout) + "\n[Truncated]" : stdout,
      stderr: stderr.length > maxStderr ? stderr.slice(0, maxStderr) + "\n[Truncated]" : stderr,
    });
  } finally {
    try {
      unlinkSync(tmpFile);
    } catch {}
  }
}
