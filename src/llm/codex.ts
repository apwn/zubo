import { randomUUID } from "crypto";
import type { LlmProvider, LlmRequest, LlmResponse, LlmContentBlock } from "./provider";
import { logger } from "../util/logger";

/**
 * LLM provider that uses OpenAI Codex CLI as the backend.
 * Spawns `codex -q <prompt>` for each request.
 */
export class CodexProvider implements LlmProvider {
  providerName = "codex";
  model: string;
  contextWindow = 200_000;

  constructor(model: string = "o4-mini") {
    this.model = model;
  }

  async chat(request: LlmRequest): Promise<LlmResponse> {
    logger.debug("Codex CLI request", {
      messageCount: request.messages.length,
      toolCount: request.tools?.length ?? 0,
    });

    // Build a combined prompt
    const parts: string[] = [];
    if (request.system) parts.push(request.system);

    for (const msg of request.messages) {
      const prefix = msg.role === "user" ? "User" : "Assistant";
      if (typeof msg.content === "string") {
        parts.push(`${prefix}: ${msg.content}`);
      } else {
        const texts = msg.content
          .filter(b => b.type === "text" && b.text)
          .map(b => b.text!);
        if (texts.length) parts.push(`${prefix}: ${texts.join("\n")}`);

        const results = msg.content
          .filter(b => b.type === "tool_result")
          .map(b => `[Tool result for ${b.tool_use_id}]: ${b.content ?? "no output"}`);
        if (results.length) parts.push(results.join("\n"));
      }
    }

    if (request.tools?.length) {
      const toolHint = request.tools.map(t =>
        `Tool: ${t.name} - ${t.description}\nParameters: ${JSON.stringify(t.input_schema)}`
      ).join("\n\n");
      parts.push(`\nAvailable tools:\n${toolHint}\n\nTo use a tool, respond with JSON: {"tool_use": {"name": "tool_name", "input": {...}}}`);
    }

    const prompt = parts.join("\n\n");

    const args = ["codex", "exec"];
    if (this.model) args.push("--model", this.model);
    args.push(prompt);

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
        throw new Error(`Codex CLI exited with code ${exitCode}: ${stderr.slice(0, 500)}`);
      }

      const responseText = stdout.trim() || "Task completed successfully";

      const content: LlmContentBlock[] = [];

      // Check for tool_use response
      try {
        const maybeToolUse = JSON.parse(responseText);
        if (maybeToolUse.tool_use) {
          content.push({
            type: "tool_use",
            id: `cx_${randomUUID()}`,
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
        usage: { inputTokens: 0, outputTokens: 0 },
      };
    } catch (err: any) {
      logger.error("Codex CLI error", { error: err.message });
      throw err;
    }
  }
}
