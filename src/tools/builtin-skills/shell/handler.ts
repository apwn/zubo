const BLOCKED_PATTERNS = [
  /\brm\s+(-[a-zA-Z]*)?.*\s+\/\s*$/,   // rm -rf /
  /\bmkfs\b/,
  /\bdd\s+.*of=\/dev\//,
  />\s*\/dev\/sd/,
  /\bshutdown\b/,
  /\breboot\b/,
  /\b:(){ :\|:& };:/,                    // fork bomb
  /\bkill\s+(-9\s+)?-1\b/,              // kill all processes
  /\bchmod\s+0{3}\s+\//,                // chmod 000 /
  /\bchown\s+.*\s+\/\s*$/,              // chown ... /
  /\bfind\s+\/\s+.*-delete\b/,          // find / -delete
  /\bcurl\s+.*\|\s*sh\b/,               // curl pipe to sh
  /\bwget\s+.*\|\s*sh\b/,               // wget pipe to sh
  /bash\s+-i\s+>&\s*\/dev\/tcp\//,      // reverse shell
  /\b>\s*\/dev\/[sv]d/,                  // overwrite disk devices
  /\bnc\s+(-[a-zA-Z]*\s+)*-e\b/,        // netcat reverse shell
];

const SENSITIVE_ENV_KEYS = [
  "ANTHROPIC_API_KEY",
  "OPENAI_API_KEY",
  "AWS_SECRET_ACCESS_KEY",
  "GITHUB_TOKEN",
  "NPM_TOKEN",
  "DATABASE_URL",
];

function sanitizeEnv(): Record<string, string | undefined> {
  const env = { ...process.env };
  for (const key of SENSITIVE_ENV_KEYS) {
    delete env[key];
  }
  // Also strip any key containing SECRET, TOKEN, PASSWORD, CREDENTIAL
  for (const key of Object.keys(env)) {
    if (/SECRET|TOKEN|PASSWORD|CREDENTIAL|PRIVATE_KEY/i.test(key)) {
      delete env[key];
    }
  }
  return env;
}

export default async function (input: Record<string, unknown>): Promise<string> {
  const command = input.command as string;
  const timeout = (input.timeout as number) || 30000;

  // Block obviously destructive commands
  for (const pattern of BLOCKED_PATTERNS) {
    if (pattern.test(command)) {
      throw new Error(`Blocked: command matches dangerous pattern`);
    }
  }

  const proc = Bun.spawn(["sh", "-c", command], {
    stdout: "pipe",
    stderr: "pipe",
    env: sanitizeEnv(),
  });

  // Set up timeout that kills the process
  let timedOut = false;
  const timer = setTimeout(() => {
    timedOut = true;
    try {
      proc.kill();
    } catch {}
  }, timeout);

  // Read stdout and stderr in parallel to avoid deadlock
  const [stdout, stderr] = await Promise.all([
    new Response(proc.stdout).text(),
    new Response(proc.stderr).text(),
  ]);
  const exitCode = await proc.exited;

  clearTimeout(timer);

  return JSON.stringify({
    exitCode,
    timedOut,
    stdout: stdout.slice(0, 50000),
    stderr: stderr.slice(0, 10000),
  });
}
