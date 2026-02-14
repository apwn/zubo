import { existsSync } from "fs";
import { resolve } from "path";
import { safeExceptionError } from "../../api-helpers";

export default async function (input: Record<string, unknown>): Promise<string> {
  const { task, workdir, model, allowedTools } = input as {
    task: string;
    workdir?: string;
    model?: string;
    allowedTools?: string[];
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

  // Validate tool names
  if (allowedTools?.length) {
    for (const tool of allowedTools) {
      if (!/^[a-zA-Z0-9_\-:]+$/.test(tool)) {
        return JSON.stringify({ error: `Invalid tool name: ${tool}` });
      }
    }
  }

  // Check if claude CLI is available
  try {
    const which = Bun.spawn(["which", "claude"], { stdout: "pipe", stderr: "pipe" });
    await which.exited;
    if (which.exitCode !== 0) {
      return JSON.stringify({ error: "Claude Code CLI not found. Install it first: https://docs.anthropic.com/en/docs/claude-code" });
    }
  } catch {
    return JSON.stringify({ error: "Failed to check for Claude Code CLI" });
  }

  const args = ["claude", "-p", task, "--output-format", "json"];
  if (model) args.push("--model", model);
  if (allowedTools?.length) args.push("--allowedTools", allowedTools.join(","));

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
        error: `Claude Code exited with code ${exitCode}`,
        stderr: stderr.slice(0, 2000),
      });
    }

    // Try to parse JSON output from claude --output-format json
    try {
      const parsed = JSON.parse(stdout);
      // Extract the result text from the JSON response
      if (parsed.result) return typeof parsed.result === "string" ? parsed.result : JSON.stringify(parsed.result);
      if (parsed.content) {
        // Claude Code returns { content: [...] } format
        const textBlocks = (Array.isArray(parsed.content) ? parsed.content : [parsed.content])
          .filter((b: any) => b.type === "text")
          .map((b: any) => b.text);
        if (textBlocks.length) return textBlocks.join("\n");
      }
      return JSON.stringify(parsed);
    } catch {
      // If not valid JSON, return raw stdout
      return stdout.slice(0, 50000);
    }
  } catch (err: any) {
    return safeExceptionError(err, "Claude Code");
  }
}
