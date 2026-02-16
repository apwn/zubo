import { randomUUID } from "crypto";
import type { LlmProvider, LlmRequest, LlmResponse, LlmContentBlock } from "./provider";
import { logger } from "../util/logger";

/** Try to extract a tool_use JSON from the response, handling markdown fences and surrounding text. */
function extractToolUse(text: string): { name: string; input: Record<string, unknown> } | null {
  // 1. Try exact parse
  try {
    const parsed = JSON.parse(text);
    if (parsed.tool_use?.name) return parsed.tool_use;
  } catch {}

  // 2. Try extracting from markdown code fences: ```json ... ``` or ``` ... ```
  const fenceMatch = text.match(/```(?:json)?\s*\n?([\s\S]*?)\n?```/);
  if (fenceMatch) {
    try {
      const parsed = JSON.parse(fenceMatch[1].trim());
      if (parsed.tool_use?.name) return parsed.tool_use;
    } catch {}
  }

  // 3. Try finding a JSON object with "tool_use" anywhere in the text
  const braceMatch = text.match(/\{[\s\S]*"tool_use"[\s\S]*\}/);
  if (braceMatch) {
    try {
      const parsed = JSON.parse(braceMatch[0]);
      if (parsed.tool_use?.name) return parsed.tool_use;
    } catch {}
  }

  return null;
}

/**
 * LLM provider that uses OpenAI Codex CLI as the backend.
 * Spawns `codex -q <prompt>` for each request.
 */
export class CodexProvider implements LlmProvider {
  providerName = "codex";
  model: string;
  contextWindow = 200_000;

  constructor(model: string = "default") {
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
      parts.push([
        `\n## TOOLS`,
        `You have the following tools available. When the user's request can be fulfilled by a tool, you MUST use it.`,
        `Do NOT say you can't do something if a matching tool exists — call it instead.\n`,
        toolHint,
        `\n## HOW TO CALL A TOOL`,
        `Respond with ONLY this JSON (no markdown, no explanation, no wrapping):`,
        `{"tool_use": {"name": "TOOL_NAME", "input": {PARAMETERS}}}`,
        ``,
        `Example — user says "add buy milk to my todos":`,
        `{"tool_use": {"name": "todos", "input": {"action": "add", "title": "Buy milk"}}}`,
        ``,
        `CRITICAL: Output raw JSON only. No \`\`\`json blocks. No text before or after. Just the JSON object.`,
        `If you don't need a tool, respond normally with text.`,
      ].join("\n"));
    }

    const prompt = parts.join("\n\n");

    const args = ["codex", "exec"];
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

      // Check for tool_use response — try exact JSON first, then extract from text
      const toolUse = extractToolUse(responseText);
      if (toolUse) {
        content.push({
          type: "tool_use",
          id: `cx_${randomUUID()}`,
          name: toolUse.name,
          input: toolUse.input ?? {},
        });
        return {
          content,
          stopReason: "tool_use",
          usage: { inputTokens: 0, outputTokens: 0 },
        };
      }

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
