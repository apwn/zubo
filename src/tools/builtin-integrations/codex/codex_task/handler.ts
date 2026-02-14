import { existsSync } from "fs";
import { resolve } from "path";
import { safeExceptionError } from "../../api-helpers";

export default async function (input: Record<string, unknown>): Promise<string> {
  const { task, workdir, model } = input as {
    task: string;
    workdir?: string;
    model?: string;
  };

  if (!task) return JSON.stringify({ error: "task is required" });
  if (task.length > 50000) return JSON.stringify({ error: "task too long (max 50000 chars)" });

  // Validate workdir
  if (workdir) {
    const resolved = resolve(workdir);
    if (resolved === "/" || resolved.startsWith("/etc") || resolved.startsWith("/sys") || resolved.startsWith("/proc")) {
      return JSON.stringify({ error: "Invalid workdir: system directories not allowed" });
    }
    if (!existsSync(resolved)) {
      return JSON.stringify({ error: "workdir does not exist" });
    }
  }

  // Validate model name
  if (model && !/^[a-z0-9\-\.:_]+$/i.test(model)) {
    return JSON.stringify({ error: "Invalid model name format" });
  }

  // Check if codex CLI is available
  try {
    const which = Bun.spawn(["which", "codex"], { stdout: "pipe", stderr: "pipe" });
    await which.exited;
    if (which.exitCode !== 0) {
      return JSON.stringify({ error: "OpenAI Codex CLI not found. Install it first: npm install -g @openai/codex" });
    }
  } catch {
    return JSON.stringify({ error: "Failed to check for Codex CLI" });
  }

  const args = ["codex", "-q", task];
  if (model) args.push("--model", model);

  try {
    const proc = Bun.spawn(args, {
      stdout: "pipe",
      stderr: "pipe",
      cwd: workdir ? resolve(workdir) : undefined,
    });

    const timeout = setTimeout(() => {
      try { proc.kill(); } catch {}
    }, 300000); // 5 minute timeout

    const exitCode = await proc.exited;
    clearTimeout(timeout);

    const stdout = await new Response(proc.stdout as ReadableStream).text();
    const stderr = await new Response(proc.stderr as ReadableStream).text();

    if (exitCode !== 0) {
      return JSON.stringify({
        error: `Codex exited with code ${exitCode}`,
        stderr: stderr.slice(0, 2000),
      });
    }

    return stdout.slice(0, 50000) || "Task completed successfully (no output)";
  } catch (err: any) {
    return safeExceptionError(err, "Codex");
  }
}
