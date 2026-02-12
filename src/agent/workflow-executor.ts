import type { LlmProvider } from "../llm/provider";
import type { WorkflowDefinition, WorkflowStep } from "./workflow";
import { getWorkflowDefinition } from "./workflow";
import { delegateToAgent } from "./delegate";
import { agentLoop } from "./loop";
import { getDb } from "../db/connection";
import { logger } from "../util/logger";

export interface StepResult {
  step: string;
  status: "success" | "error";
  output: string;
  durationMs: number;
}

export interface WorkflowResult {
  workflowName: string;
  status: "completed" | "failed" | "partial";
  steps: StepResult[];
  summary: string;
}

/**
 * Execute a workflow by name.
 * Steps are executed respecting dependencies via topological ordering.
 * Independent steps run in parallel.
 */
export async function executeWorkflow(
  llm: LlmProvider,
  workflowName: string,
  input: string,
  onStepComplete?: (step: StepResult) => void
): Promise<WorkflowResult> {
  const def = getWorkflowDefinition(workflowName);
  if (!def) {
    return {
      workflowName,
      status: "failed",
      steps: [],
      summary: `Workflow "${workflowName}" not found`,
    };
  }

  const db = getDb();

  // Log execution start
  let executionId: number;
  try {
    const result = db.prepare(
      "INSERT INTO workflow_executions (workflow_name, input, status) VALUES (?, ?, 'running')"
    ).run(workflowName, input);
    executionId = Number(result.lastInsertRowid);
  } catch {
    executionId = 0;
  }

  // Build outputs map for variable substitution
  const outputs = new Map<string, string>();
  outputs.set("input", input);

  // Topological sort + parallel execution
  const completed = new Set<string>();
  const stepResults: StepResult[] = [];
  const stepMap = new Map(def.steps.map((s) => [s.name, s]));

  while (completed.size < def.steps.length) {
    // Find all steps whose dependencies are met
    const ready = def.steps.filter(
      (s) =>
        !completed.has(s.name) &&
        s.dependsOn.every((dep) => completed.has(dep))
    );

    if (ready.length === 0) {
      // Deadlock — some steps have unresolvable dependencies
      logger.error("Workflow deadlock", { workflowName, completed: [...completed] });
      break;
    }

    // Execute ready steps in parallel
    const results = await Promise.allSettled(
      ready.map((step) => executeStep(llm, step, outputs, executionId))
    );

    for (let i = 0; i < ready.length; i++) {
      const step = ready[i];
      const result = results[i];

      let stepResult: StepResult;
      if (result.status === "fulfilled") {
        stepResult = result.value;
        if (step.outputVar) {
          outputs.set(step.outputVar, stepResult.output);
        }
      } else {
        stepResult = {
          step: step.name,
          status: "error",
          output: result.reason?.message ?? "Unknown error",
          durationMs: 0,
        };
      }

      completed.add(step.name);
      stepResults.push(stepResult);
      onStepComplete?.(stepResult);
    }
  }

  const hasErrors = stepResults.some((r) => r.status === "error");
  const allDone = completed.size === def.steps.length;
  const status = allDone && !hasErrors ? "completed" : allDone ? "partial" : "failed";

  const summary = stepResults
    .map((r) => `${r.step}: ${r.status}${r.status === "error" ? ` (${r.output.slice(0, 100)})` : ""}`)
    .join("\n");

  // Log execution end
  try {
    db.prepare(
      "UPDATE workflow_executions SET status = ?, result = ?, completed_at = datetime('now') WHERE id = ?"
    ).run(status, summary, executionId);
  } catch {}

  return { workflowName, status, steps: stepResults, summary };
}

async function executeStep(
  llm: LlmProvider,
  step: WorkflowStep,
  outputs: Map<string, string>,
  executionId: number
): Promise<StepResult> {
  const startTime = Date.now();
  const db = getDb();

  // Variable substitution in task template (escape regex special chars in key)
  let task = step.task;
  for (const [key, value] of outputs) {
    const escapedKey = key.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    task = task.replace(new RegExp(`\\$${escapedKey}`, "g"), value);
  }

  // Log step start
  try {
    db.prepare(
      "INSERT INTO workflow_step_logs (execution_id, step_name, agent_name, task, status, started_at) VALUES (?, ?, ?, ?, 'running', datetime('now'))"
    ).run(executionId, step.name, step.agent, task);
  } catch {}

  logger.info(`Workflow step "${step.name}" starting`, { agent: step.agent, task: task.slice(0, 100) });

  let output: string;
  try {
    if (step.agent === "main") {
      const sessionId = `workflow:${executionId}:${step.name}`;
      const result = await agentLoop(llm, sessionId, task, { maxRounds: 8 });
      output = result.reply;
    } else {
      output = await delegateToAgent(llm, step.agent, task);
    }
  } catch (err: any) {
    const durationMs = Date.now() - startTime;
    try {
      db.prepare(
        "UPDATE workflow_step_logs SET status = 'error', output = ?, completed_at = datetime('now'), duration_ms = ? WHERE execution_id = ? AND step_name = ?"
      ).run(err.message, durationMs, executionId, step.name);
    } catch {}
    return { step: step.name, status: "error", output: err.message, durationMs };
  }

  const durationMs = Date.now() - startTime;

  // Log step completion
  try {
    db.prepare(
      "UPDATE workflow_step_logs SET status = 'success', output = ?, completed_at = datetime('now'), duration_ms = ? WHERE execution_id = ? AND step_name = ?"
    ).run(output.slice(0, 10000), durationMs, executionId, step.name);
  } catch {}

  logger.info(`Workflow step "${step.name}" completed in ${durationMs}ms`);

  return { step: step.name, status: "success", output, durationMs };
}
