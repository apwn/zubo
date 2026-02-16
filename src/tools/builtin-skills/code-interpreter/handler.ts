import { mkdirSync, readdirSync, writeFileSync } from "fs";
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

const IMAGE_EXTENSIONS = new Set([".png", ".jpg", ".jpeg", ".svg", ".gif", ".webp"]);

/** Persistent workspace directory for code interpreter sessions */
const WORKSPACE_DIR = join(homedir(), ".zubo", "workspace", "code-interpreter");

/** Build a broad PATH that includes common install locations for python3, pip, bun, node, etc. */
function buildEnv(): Record<string, string> {
  const home = homedir();
  const extraPaths = [
    join(home, ".local", "bin"),
    join(home, ".bun", "bin"),
    join(home, "Library", "Python", "3.11", "bin"),
    join(home, "Library", "Python", "3.12", "bin"),
    join(home, "Library", "Python", "3.13", "bin"),
    "/opt/homebrew/bin",
    "/opt/homebrew/sbin",
    "/usr/local/bin",
    "/usr/bin",
    "/bin",
    "/usr/sbin",
    "/sbin",
  ];
  const existingPath = process.env.PATH ?? "/usr/local/bin:/usr/bin:/bin";
  const fullPath = [...extraPaths, ...existingPath.split(":")].filter(Boolean);
  // Deduplicate while preserving order
  const seen = new Set<string>();
  const dedupedPath = fullPath.filter((p) => {
    if (seen.has(p)) return false;
    seen.add(p);
    return true;
  });

  return {
    HOME: home,
    PATH: dedupedPath.join(":"),
    LANG: process.env.LANG ?? "en_US.UTF-8",
    TERM: process.env.TERM ?? "xterm-256color",
    USER: process.env.USER ?? "",
    SHELL: process.env.SHELL ?? "/bin/sh",
    TMPDIR: process.env.TMPDIR ?? "/tmp",
    // Python: don't buffer stdout so prints appear immediately in captured output
    PYTHONUNBUFFERED: "1",
    // Bun / Node
    NODE_ENV: process.env.NODE_ENV ?? "development",
    BUN_INSTALL: process.env.BUN_INSTALL ?? join(home, ".bun"),
  };
}

/** Snapshot all files recursively under a directory, returning a Set of absolute paths. */
function snapshotFiles(dir: string): Set<string> {
  const files = new Set<string>();
  try {
    const entries = readdirSync(dir, { withFileTypes: true, recursive: true });
    for (const entry of entries) {
      if (entry.isFile()) {
        const parent = (entry as any).parentPath ?? (entry as any).path ?? dir;
        files.add(join(parent, entry.name));
      }
    }
  } catch {
    // Directory may not exist yet on first run
  }
  return files;
}

/** Return newly created image files by diffing two snapshots. */
function detectNewImageFiles(before: Set<string>, after: Set<string>): string[] {
  const newFiles: string[] = [];
  for (const filePath of after) {
    if (!before.has(filePath)) {
      const ext = filePath.substring(filePath.lastIndexOf(".")).toLowerCase();
      if (IMAGE_EXTENSIONS.has(ext)) {
        newFiles.push(filePath);
      }
    }
  }
  return newFiles.sort();
}

/** Install packages before running user code. Returns { ok, output } */
async function installPackages(
  packages: string[],
  language: string,
  env: Record<string, string>,
  cwd: string
): Promise<{ ok: boolean; output: string }> {
  if (packages.length === 0) return { ok: true, output: "" };

  // Sanitize package names: only allow valid package name characters
  const safeNamePattern = /^[@a-zA-Z0-9._\/-]+(>=?|<=?|==|~=|!=)?[a-zA-Z0-9._*]*$/;
  for (const pkg of packages) {
    if (!safeNamePattern.test(pkg)) {
      return { ok: false, output: `Blocked: invalid package name "${pkg}"` };
    }
  }

  let cmd: string[];
  if (language === "python") {
    cmd = ["pip", "install", ...packages, "--quiet", "--disable-pip-version-check"];
  } else {
    // javascript or typescript — use bun
    cmd = ["bun", "add", ...packages];
  }

  try {
    const proc = Bun.spawn(cmd, {
      stdout: "pipe",
      stderr: "pipe",
      env,
      cwd,
    });

    // 60s timeout for package installs
    let timedOut = false;
    const timer = setTimeout(() => {
      timedOut = true;
      try { proc.kill(9); } catch {}
    }, 60000);

    const [stdout, stderr] = await Promise.all([
      new Response(proc.stdout).text(),
      new Response(proc.stderr).text(),
    ]);
    const exitCode = await proc.exited;
    clearTimeout(timer);

    if (timedOut) {
      return { ok: false, output: "Package install timed out (60s limit)." };
    }

    if (exitCode !== 0) {
      const combined = (stdout + "\n" + stderr).trim();
      return { ok: false, output: `Package install failed (exit ${exitCode}):\n${combined.slice(0, 5000)}` };
    }

    return { ok: true, output: (stdout + "\n" + stderr).trim() };
  } catch (err: any) {
    return { ok: false, output: `Package install error: ${err.message ?? err}` };
  }
}

export default async function (input: Record<string, unknown>): Promise<string> {
  const code = input.code as string;
  const language = input.language as string;
  const packages = (input.packages as string[] | undefined) ?? [];

  if (!code || !language) {
    throw new Error("Both 'code' and 'language' are required.");
  }

  if (!["python", "javascript", "typescript"].includes(language)) {
    throw new Error(`Unsupported language: "${language}". Use python, javascript, or typescript.`);
  }

  if (code.length > 50000) {
    throw new Error("Code too long (max 50,000 characters).");
  }

  // Validate packages input
  if (!Array.isArray(packages)) {
    throw new Error("'packages' must be an array of strings.");
  }

  // Block dangerous patterns
  for (const pattern of DANGEROUS_PATTERNS) {
    if (pattern.test(code)) {
      throw new Error("Blocked: this code contains potentially dangerous operations.");
    }
  }

  const timeout = 30000;
  const maxStdout = 50000;
  const maxStderr = 10000;

  // Ensure persistent workspace exists
  mkdirSync(WORKSPACE_DIR, { recursive: true });

  const env = buildEnv();

  // ── Step 1: Install packages if requested ──
  let installOutput = "";
  if (packages.length > 0) {
    const result = await installPackages(packages, language, env, WORKSPACE_DIR);
    installOutput = result.output;
    if (!result.ok) {
      return JSON.stringify({
        exitCode: 1,
        timedOut: false,
        executionTime: 0,
        stdout: "",
        stderr: installOutput,
        files: [],
      });
    }
  }

  // ── Step 2: Write code to a file in the persistent workspace ──
  const ext = language === "python" ? ".py" : language === "typescript" ? ".ts" : ".js";
  const scriptName = `exec_${Date.now()}_${Math.random().toString(36).slice(2)}${ext}`;
  const scriptPath = join(WORKSPACE_DIR, scriptName);
  writeFileSync(scriptPath, code);

  // ── Step 3: Snapshot files before execution (for detecting new outputs) ──
  const filesBefore = snapshotFiles(WORKSPACE_DIR);

  // ── Step 4: Execute ──
  const cmd =
    language === "python"
      ? ["python3", scriptPath]
      : ["bun", "run", scriptPath];

  const startTime = Date.now();
  const proc = Bun.spawn(cmd, {
    stdout: "pipe",
    stderr: "pipe",
    env,
    cwd: WORKSPACE_DIR,
  });

  let timedOut = false;
  const timer = setTimeout(() => {
    timedOut = true;
    try { proc.kill(9); } catch {}
  }, timeout);

  const [stdout, stderr] = await Promise.all([
    new Response(proc.stdout).text(),
    new Response(proc.stderr).text(),
  ]);
  const exitCode = await proc.exited;
  clearTimeout(timer);

  const executionTime = Date.now() - startTime;

  // ── Step 5: Detect newly created image files ──
  const filesAfter = snapshotFiles(WORKSPACE_DIR);
  const newImageFiles = detectNewImageFiles(filesBefore, filesAfter);

  // ── Step 6: Build result ──
  const result: Record<string, unknown> = {
    exitCode,
    timedOut,
    executionTime,
    stdout: stdout.length > maxStdout ? stdout.slice(0, maxStdout) + "\n[Truncated]" : stdout,
    stderr: stderr.length > maxStderr ? stderr.slice(0, maxStderr) + "\n[Truncated]" : stderr,
    files: newImageFiles,
  };

  // Include install log only when packages were requested
  if (packages.length > 0 && installOutput) {
    result.installLog = installOutput.slice(0, 3000);
  }

  return JSON.stringify(result);
}
