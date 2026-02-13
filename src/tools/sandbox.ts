import { join } from "path";
import { logger } from "../util/logger";

const SANDBOX_RUNNER = join(import.meta.dir, "sandbox-runner.ts");

export interface SandboxOptions {
  timeoutMs?: number;
  env?: Record<string, string>;
}

/**
 * Execute a skill handler in a sandboxed subprocess.
 * The handler runs in a separate Bun process with no access to the parent's globals.
 * Secrets are passed via environment variables.
 */
export async function executeSandboxed(
  handlerPath: string,
  input: Record<string, unknown>,
  options: SandboxOptions = {}
): Promise<string> {
  const timeoutMs = options.timeoutMs ?? 30_000;

  const proc = Bun.spawn(
    ["bun", "run", SANDBOX_RUNNER, handlerPath, JSON.stringify(input)],
    {
      stdout: "pipe",
      stderr: "pipe",
      env: {
        ...options.env,
        // Minimal env — don't pass full parent env to prevent secret leakage
        HOME: process.env.HOME ?? "",
        PATH: "/usr/local/bin:/usr/bin:/bin",
        NODE_ENV: process.env.NODE_ENV ?? "production",
      },
    }
  );

  // Timeout enforcement
  const timer = setTimeout(() => {
    try {
      proc.kill();
    } catch (err: any) {
      logger.warn("Failed to kill timed-out sandbox process", { error: (err as Error).message });
    }
  }, timeoutMs);

  try {
    const exitCode = await proc.exited;
    clearTimeout(timer);

    const stdout = await new Response(proc.stdout).text();
    const stderr = await new Response(proc.stderr).text();

    if (exitCode !== 0) {
      const errMsg = stderr.trim() || `Process exited with code ${exitCode}`;
      logger.error("Sandboxed skill error", { handlerPath, exitCode, stderr: errMsg.slice(0, 500) });
      throw new Error(`Skill execution failed: ${errMsg.slice(0, 200)}`);
    }

    // Parse the JSON result from stdout
    try {
      const result = JSON.parse(stdout.trim());
      return typeof result === "string" ? result : JSON.stringify(result);
    } catch {
      // If not valid JSON, return raw stdout
      return stdout.trim();
    }
  } catch (err: any) {
    clearTimeout(timer);
    if (err.message?.includes("Skill execution failed")) throw err;
    throw new Error(`Sandbox error: ${err.message}`);
  }
}
