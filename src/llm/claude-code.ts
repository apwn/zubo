import { randomUUID } from "crypto";
import type { LlmProvider, LlmRequest, LlmResponse, LlmContentBlock } from "./provider";
import { logger } from "../util/logger";

/**
 * LLM provider that uses Claude Code CLI as the backend.
 * Spawns `claude -p <prompt> --output-format json` for each request.
 */
export class ClaudeCodeProvider implements LlmProvider {
  providerName = "claude-code";
  model: string;
  contextWindow = 200_000;

  constructor(model: string = "default") {
    this.model = model;
  }

  async chat(request: LlmRequest): Promise<LlmResponse> {
    logger.debug("Claude Code CLI request", {
      messageCount: request.messages.length,
      toolCount: request.tools?.length ?? 0,
    });

    // Build a combined prompt from system + messages
    const parts: string[] = [];
    if (request.system) parts.push(request.system);

    for (const msg of request.messages) {
      const prefix = msg.role === "user" ? "User" : "Assistant";
      if (typeof msg.content === "string") {
        parts.push(`${prefix}: ${msg.content}`);
      } else {
        // Extract text blocks
        const texts = msg.content
          .filter(b => b.type === "text" && b.text)
          .map(b => b.text!);
        if (texts.length) parts.push(`${prefix}: ${texts.join("\n")}`);

        // Include tool results
        const results = msg.content
          .filter(b => b.type === "tool_result")
          .map(b => `[Tool result for ${b.tool_use_id}]: ${b.content ?? "no output"}`);
        if (results.length) parts.push(results.join("\n"));
      }
    }

    // Build tool definitions hint if tools are provided
    if (request.tools?.length) {
      const toolHint = request.tools.map(t =>
        `Tool: ${t.name} - ${t.description}\nParameters: ${JSON.stringify(t.input_schema)}`
      ).join("\n\n");
      parts.push(`\nAvailable tools:\n${toolHint}\n\nTo use a tool, respond with JSON: {"tool_use": {"name": "tool_name", "input": {...}}}`);
    }

    const prompt = parts.join("\n\n");

    const args = ["claude", "-p", prompt, "--output-format", "json"];

    try {
      const proc = Bun.spawn(args, {
        stdout: "pipe",
        stderr: "pipe",
      });

      const timeout = setTimeout(() => {
        try { proc.kill(); } catch {}
      }, 300000);

      let exitCode: number;
      let stdout: string;
      let stderr: string;
      try {
        exitCode = await proc.exited;
        stdout = await new Response(proc.stdout as ReadableStream).text();
        stderr = await new Response(proc.stderr as ReadableStream).text();
      } finally {
        clearTimeout(timeout);
      }

      if (exitCode !== 0) {
        throw new Error(`Claude Code CLI exited with code ${exitCode}: ${stderr.slice(0, 500)}`);
      }

      // Parse JSON output
      let responseText = stdout;
      try {
        const parsed = JSON.parse(stdout);
        if (parsed.result) {
          responseText = typeof parsed.result === "string" ? parsed.result : JSON.stringify(parsed.result);
        } else if (parsed.content && Array.isArray(parsed.content)) {
          const textBlocks = parsed.content.filter((b: any) => b.type === "text").map((b: any) => b.text);
          responseText = textBlocks.join("\n") || stdout;
        }
      } catch {
        // Not JSON, use raw output
      }

      // Check if the response contains tool_use JSON
      const content: LlmContentBlock[] = [];
      try {
        const maybeToolUse = JSON.parse(responseText);
        if (maybeToolUse.tool_use) {
          content.push({
            type: "tool_use",
            id: `cc_${randomUUID()}`,
            name: maybeToolUse.tool_use.name,
            input: maybeToolUse.tool_use.input ?? {},
          });
          return {
            content,
            stopReason: "tool_use",
            usage: { inputTokens: 0, outputTokens: 0 },
          };
        }
      } catch {}

      content.push({ type: "text", text: responseText });

      return {
        content,
        stopReason: "end_turn",
        usage: {
          inputTokens: 0, // CLI doesn't report token usage
          outputTokens: 0,
        },
      };
    } catch (err: any) {
      logger.error("Claude Code CLI error", { error: err.message });
      throw err;
    }
  }
}
