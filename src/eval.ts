import { Database } from "bun:sqlite";
import { createRouter } from "./channels/router";
import type { LlmProvider, LlmRequest, LlmResponse } from "./llm/provider";
import { searchMemoryAsync } from "./memory/engine";
import { registerTool, unregisterTool } from "./tools/registry";
import { executeTool } from "./tools/executor";

class EvalLlm implements LlmProvider {
  providerName = "eval";
  model = "eval-model";
  contextWindow = 8192;

  async chat(_request: LlmRequest): Promise<LlmResponse> {
    return {
      content: [{ type: "text", text: "ok" }],
      stopReason: "end_turn",
      usage: { inputTokens: 1, outputTokens: 1 },
    };
  }
}

function createEvalDb(): Database {
  const db = new Database(":memory:");
  db.run(`
    CREATE TABLE memory_chunks (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      source_file TEXT NOT NULL,
      chunk_index INTEGER NOT NULL,
      content TEXT NOT NULL,
      embedding BLOB
    );
  `);
  db.run(`
    CREATE VIRTUAL TABLE memory_fts USING fts5(content, source_file, content='');
  `);
  return db;
}

type EvalCheck = {
  name: string;
  passed: boolean;
  durationMs: number;
  details?: string;
};

export async function runEvalCommand(): Promise<number> {
  const started = Date.now();
  const checks: EvalCheck[] = [];

  async function runCheck(name: string, fn: () => Promise<void>) {
    const t0 = Date.now();
    try {
      await fn();
      checks.push({ name, passed: true, durationMs: Date.now() - t0 });
    } catch (err: any) {
      checks.push({
        name,
        passed: false,
        durationMs: Date.now() - t0,
        details: err?.message ?? String(err),
      });
    }
  }

  await runCheck("Slash command help", async () => {
    const db = createEvalDb();
    const router = createRouter(new EvalLlm(), db);
    let output = "";
    await router.handleMessage(
      { channel: "webchat", userId: "eval", sessionKey: "webchat:eval", text: "/help" },
      async (text) => {
        output = text;
      }
    );
    db.close();
    if (!output.includes("/status") || !output.includes("/memory <query>")) {
      throw new Error("Missing expected help command output");
    }
  });

  await runCheck("Memory explainability", async () => {
    const db = createEvalDb();
    db.prepare("INSERT INTO memory_chunks (source_file, chunk_index, content) VALUES (?, ?, ?)")
      .run("eval.md", 0, "alice likes espresso");
    db.prepare("INSERT INTO memory_fts (rowid, content, source_file) VALUES (?, ?, ?)")
      .run(1, "alice likes espresso", "eval.md");
    const results = await searchMemoryAsync(db, "alice", 3);
    db.close();
    if (!results.length) throw new Error("No memory results");
    if (!results[0].matchType) throw new Error("Missing matchType");
    if (typeof results[0].confidence !== "number") throw new Error("Missing confidence");
  });

  await runCheck("Dry-run safety", async () => {
    let executed = false;
    registerTool({
      definition: {
        name: "eval_exec_tool",
        description: "Eval tool",
        input_schema: { type: "object", properties: { x: { type: "string" } } },
      },
      async execute() {
        executed = true;
        return "done";
      },
    });
    const result = await executeTool("eval_exec_tool", "eval1", { x: "1", _dryRun: true });
    unregisterTool("eval_exec_tool");
    if (!result.content.includes("DRY RUN ONLY")) throw new Error("Dry-run response missing");
    if (executed) throw new Error("Tool executed during dry-run");
  });

  const failed = checks.filter((c) => !c.passed);
  const passedCount = checks.length - failed.length;
  const totalMs = Date.now() - started;

  console.log("\nZubo Eval");
  console.log("=========");
  for (const check of checks) {
    const icon = check.passed ? "PASS" : "FAIL";
    console.log(`${icon}  ${check.name} (${check.durationMs}ms)`);
    if (check.details) console.log(`      ${check.details}`);
  }
  console.log(`\nSummary: ${passedCount}/${checks.length} passed in ${totalMs}ms`);

  return failed.length ? 1 : 0;
}
