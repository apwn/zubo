import { Cron } from "croner";
import { getDb } from "../db/connection";
import { logger } from "../util/logger";
import { executeTool as realExecuteTool } from "../tools/executor";
import type { ToolResult } from "../tools/executor";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface WorkflowStep {
  id: string;
  type: "tool" | "condition" | "agent" | "message" | "delay";
  config: Record<string, any>;
  next?: string; // id of the next step (linear flow)
}

// ---------------------------------------------------------------------------
// Overridable executeTool (allows tests to inject a mock without mock.module)
// ---------------------------------------------------------------------------

type ExecuteToolFn = (name: string, toolUseId: string, input: Record<string, unknown>) => Promise<ToolResult>;

let _executeTool: ExecuteToolFn = realExecuteTool;

/** @internal Test-only hook to override executeTool without mock.module pollution. */
export function __setExecuteTool(fn: ExecuteToolFn | null): void {
  _executeTool = fn ?? realExecuteTool;
}

interface VisualWorkflowRow {
  id: string;
  name: string;
  description: string | null;
  trigger_type: "manual" | "cron" | "webhook";
  trigger_config: string; // JSON
  steps: string; // JSON
  canvas_data: string | null; // JSON
  enabled: number;
  created_at: string;
  updated_at: string;
  last_run_at: string | null;
  run_count: number;
}

interface TriggerConfig {
  schedule?: string;
  webhookId?: string;
}

interface ExecutionContext {
  trigger: { payload: any };
  steps: Record<string, { result: any }>;
}

// ---------------------------------------------------------------------------
// Module-level state
// ---------------------------------------------------------------------------

const cronJobs = new Map<string, Cron>();

// ---------------------------------------------------------------------------
// Template resolution helper
// ---------------------------------------------------------------------------

function resolveTemplates(text: string, context: any): string {
  return text.replace(/\{\{([^}]+)\}\}/g, (_, path) => {
    const parts = path.trim().split(".");
    let val: any = context;
    for (const p of parts) {
      val = val?.[p];
      if (val === undefined) return `{{${path}}}`;
    }
    return typeof val === "string" ? val : JSON.stringify(val);
  });
}

/**
 * Recursively resolve template variables inside an arbitrary object/value.
 * Strings are resolved via `resolveTemplates`, arrays/objects are walked
 * recursively, and everything else is returned as-is.
 */
function resolveConfigTemplates(value: any, context: any): any {
  if (typeof value === "string") {
    return resolveTemplates(value, context);
  }
  if (Array.isArray(value)) {
    return value.map((v) => resolveConfigTemplates(v, context));
  }
  if (value !== null && typeof value === "object") {
    const out: Record<string, any> = {};
    for (const [k, v] of Object.entries(value)) {
      out[k] = resolveConfigTemplates(v, context);
    }
    return out;
  }
  return value;
}

// ---------------------------------------------------------------------------
// Step executors (private helpers)
// ---------------------------------------------------------------------------

async function executeToolStep(
  config: Record<string, any>,
  context: ExecutionContext,
  stepId: string,
): Promise<string> {
  const toolName: string = config.toolName;
  const rawInput: Record<string, any> = config.input ?? {};
  const resolvedInput = resolveConfigTemplates(rawInput, context);

  const result = await _executeTool(toolName, crypto.randomUUID(), resolvedInput);

  const output = result.content;
  context.steps[stepId] = { result: output };

  if (result.is_error) {
    logger.warn("Visual workflow tool step returned error", { stepId, toolName, output });
  }

  return output;
}

function evaluateCondition(
  config: Record<string, any>,
  context: ExecutionContext,
): { nextStepId: string | undefined } {
  const expression: string | undefined = config.expression;
  const sourceStepId: string | undefined = config.sourceStepId;

  let conditionMet = true;

  if (expression && sourceStepId) {
    const sourceResult = context.steps[sourceStepId]?.result;
    const sourceStr = typeof sourceResult === "string" ? sourceResult : JSON.stringify(sourceResult ?? "");

    if (expression.startsWith("contains:")) {
      const needle = expression.slice("contains:".length);
      conditionMet = sourceStr.includes(needle);
    } else if (expression.startsWith("equals:")) {
      const expected = expression.slice("equals:".length);
      conditionMet = sourceStr === expected;
    } else if (expression === "truthy") {
      conditionMet = !!sourceResult;
    } else {
      // Unknown expression format — default to true
      logger.warn("Unknown condition expression, defaulting to true", { expression });
      conditionMet = true;
    }
  }

  return {
    nextStepId: conditionMet ? config.thenStepId : config.elseStepId,
  };
}

async function executeAgentStep(
  config: Record<string, any>,
  context: ExecutionContext,
  stepId: string,
  workflowId: string,
): Promise<string> {
  const resolvedPrompt = resolveTemplates(config.prompt ?? "", context);

  const { loadConfig } = await import("../config/loader");
  const { createProvider } = await import("../llm/factory");
  const { agentLoop } = await import("../agent/loop");

  const appConfig = await loadConfig();
  const llm = await createProvider(appConfig);
  const result = await agentLoop(llm, `workflow:${workflowId}`, resolvedPrompt);

  const output = result.reply;
  context.steps[stepId] = { result: output };
  return output;
}

function executeMessageStep(
  config: Record<string, any>,
  context: ExecutionContext,
  stepId: string,
): string {
  const resolvedText = resolveTemplates(config.text ?? "", context);

  // In production this would use router.sendProactive; for now, store as result.
  context.steps[stepId] = { result: resolvedText };
  return resolvedText;
}

async function executeDelayStep(config: Record<string, any>): Promise<void> {
  const seconds = Math.min(Math.max(Number(config.seconds) || 0, 0), 300);
  if (seconds > 0) {
    await new Promise<void>((r) => setTimeout(r, seconds * 1000));
  }
}

// ---------------------------------------------------------------------------
// Main execution engine
// ---------------------------------------------------------------------------

export async function executeVisualWorkflow(
  workflowId: string,
  triggerData?: any,
): Promise<{ success: boolean; result?: string; error?: string }> {
  const db = getDb();

  try {
    // Load workflow
    const row = db
      .query("SELECT * FROM visual_workflows WHERE id = ?")
      .get(workflowId) as VisualWorkflowRow | null;

    if (!row) {
      return { success: false, error: `Workflow not found: ${workflowId}` };
    }
    if (!row.enabled) {
      return { success: false, error: `Workflow is disabled: ${row.name}` };
    }

    // Parse steps
    let steps: WorkflowStep[];
    try {
      steps = JSON.parse(row.steps) as WorkflowStep[];
    } catch {
      return { success: false, error: "Failed to parse workflow steps JSON" };
    }

    if (!steps.length) {
      return { success: false, error: "Workflow has no steps" };
    }

    // Build step lookup map
    const stepMap = new Map<string, WorkflowStep>();
    for (const s of steps) {
      stepMap.set(s.id, s);
    }

    // Create execution record
    const execResult = db
      .prepare(
        "INSERT INTO workflow_executions (workflow_name, input, status, started_at) VALUES (?, ?, 'running', datetime('now'))",
      )
      .run(row.name, JSON.stringify(triggerData ?? null));
    const executionId = Number(execResult.lastInsertRowid);

    // Build context
    const context: ExecutionContext = {
      trigger: { payload: triggerData },
      steps: {},
    };

    let lastOutput: string | undefined;
    let currentStep: WorkflowStep | undefined = steps[0];

    try {
      while (currentStep) {
        const stepStart = Date.now();

        // Log step start
        const stepLogResult = db
          .prepare(
            "INSERT INTO workflow_step_logs (execution_id, step_name, task, status, started_at) VALUES (?, ?, ?, 'running', datetime('now'))",
          )
          .run(executionId, currentStep.id, currentStep.type);
        const stepLogId = Number(stepLogResult.lastInsertRowid);

        let stepOutput: string | undefined;
        let nextStepId: string | undefined = currentStep.next;

        try {
          switch (currentStep.type) {
            case "tool": {
              stepOutput = await executeToolStep(currentStep.config, context, currentStep.id);
              break;
            }
            case "condition": {
              const condResult = evaluateCondition(currentStep.config, context);
              stepOutput = `condition evaluated, next: ${condResult.nextStepId ?? "end"}`;
              context.steps[currentStep.id] = { result: stepOutput };
              // Override next step from condition evaluation
              nextStepId = condResult.nextStepId;
              break;
            }
            case "agent": {
              stepOutput = await executeAgentStep(currentStep.config, context, currentStep.id, workflowId);
              break;
            }
            case "message": {
              stepOutput = executeMessageStep(currentStep.config, context, currentStep.id);
              break;
            }
            case "delay": {
              await executeDelayStep(currentStep.config);
              stepOutput = `delayed ${Math.min(Number(currentStep.config.seconds) || 0, 300)}s`;
              context.steps[currentStep.id] = { result: stepOutput };
              break;
            }
            default: {
              stepOutput = `Unknown step type: ${(currentStep as any).type}`;
              context.steps[currentStep.id] = { result: stepOutput };
              logger.warn("Unknown visual workflow step type", { type: (currentStep as any).type });
            }
          }

          const durationMs = Date.now() - stepStart;

          // Log step completion
          db.prepare(
            "UPDATE workflow_step_logs SET status = 'completed', output = ?, completed_at = datetime('now'), duration_ms = ? WHERE id = ?",
          ).run(stepOutput ?? "", durationMs, stepLogId);

          lastOutput = stepOutput;
        } catch (stepErr: any) {
          const durationMs = Date.now() - stepStart;
          const errMsg = stepErr?.message ?? String(stepErr);

          db.prepare(
            "UPDATE workflow_step_logs SET status = 'failed', output = ?, completed_at = datetime('now'), duration_ms = ? WHERE id = ?",
          ).run(errMsg, durationMs, stepLogId);

          logger.error("Visual workflow step failed", {
            workflowId,
            stepId: currentStep.id,
            stepType: currentStep.type,
            error: errMsg,
          });

          // Fail the whole execution on step error
          throw stepErr;
        }

        // Advance to the next step
        if (nextStepId) {
          currentStep = stepMap.get(nextStepId);
          if (!currentStep) {
            logger.warn("Visual workflow references unknown next step", {
              workflowId,
              nextStepId,
            });
          }
        } else {
          currentStep = undefined;
        }
      }

      // Mark execution as completed
      db.prepare(
        "UPDATE workflow_executions SET status = 'completed', result = ?, completed_at = datetime('now') WHERE id = ?",
      ).run(lastOutput ?? "", executionId);

      // Update workflow metadata
      db.prepare(
        "UPDATE visual_workflows SET last_run_at = datetime('now'), run_count = run_count + 1, updated_at = datetime('now') WHERE id = ?",
      ).run(workflowId);

      logger.info("Visual workflow completed", { workflowId, name: row.name, executionId });

      return { success: true, result: lastOutput };
    } catch (execErr: any) {
      const errMsg = execErr?.message ?? String(execErr);

      db.prepare(
        "UPDATE workflow_executions SET status = 'failed', result = ?, completed_at = datetime('now') WHERE id = ?",
      ).run(errMsg, executionId);

      logger.error("Visual workflow execution failed", {
        workflowId,
        name: row.name,
        executionId,
        error: errMsg,
      });

      return { success: false, error: errMsg };
    }
  } catch (outerErr: any) {
    const errMsg = outerErr?.message ?? String(outerErr);
    logger.error("Visual workflow outer error", { workflowId, error: errMsg });
    return { success: false, error: errMsg };
  }
}

// ---------------------------------------------------------------------------
// Cron trigger registration
// ---------------------------------------------------------------------------

export function registerWorkflowTriggers(): void {
  const db = getDb();

  try {
    const rows = db
      .query("SELECT * FROM visual_workflows WHERE trigger_type = 'cron' AND enabled = 1")
      .all() as VisualWorkflowRow[];

    for (const row of rows) {
      try {
        const triggerConfig: TriggerConfig = JSON.parse(row.trigger_config || "{}");
        const schedule = triggerConfig.schedule;

        if (!schedule) {
          logger.warn("Visual workflow cron has no schedule", { workflowId: row.id, name: row.name });
          continue;
        }

        // Stop existing job for this workflow if already registered
        if (cronJobs.has(row.id)) {
          cronJobs.get(row.id)!.stop();
          cronJobs.delete(row.id);
        }

        const job = new Cron(schedule, async () => {
          logger.info("Visual workflow cron firing", { workflowId: row.id, name: row.name });
          try {
            await executeVisualWorkflow(row.id);
          } catch (err: any) {
            logger.error("Visual workflow cron execution error", {
              workflowId: row.id,
              error: err?.message ?? String(err),
            });
          }
        });

        cronJobs.set(row.id, job);
        logger.info("Registered visual workflow cron", {
          workflowId: row.id,
          name: row.name,
          schedule,
        });
      } catch (err: any) {
        logger.error("Failed to register visual workflow cron", {
          workflowId: row.id,
          name: row.name,
          error: err?.message ?? String(err),
        });
      }
    }

    logger.info("Visual workflow triggers registered", { count: cronJobs.size });
  } catch (err: any) {
    logger.error("Failed to register visual workflow triggers", {
      error: err?.message ?? String(err),
    });
  }
}

// ---------------------------------------------------------------------------
// Cleanup
// ---------------------------------------------------------------------------

export function unregisterWorkflowTriggers(): void {
  for (const [id, job] of cronJobs) {
    job.stop();
    logger.debug("Stopped visual workflow cron", { workflowId: id });
  }
  cronJobs.clear();
  logger.info("All visual workflow triggers unregistered");
}

// ---------------------------------------------------------------------------
// Webhook trigger
// ---------------------------------------------------------------------------

export async function triggerByWebhook(webhookId: string, data: any): Promise<void> {
  const db = getDb();

  try {
    const rows = db
      .query("SELECT * FROM visual_workflows WHERE trigger_type = 'webhook' AND enabled = 1")
      .all() as VisualWorkflowRow[];

    const matching: VisualWorkflowRow[] = [];

    for (const row of rows) {
      try {
        const triggerConfig: TriggerConfig = JSON.parse(row.trigger_config || "{}");
        if (triggerConfig.webhookId === webhookId) {
          matching.push(row);
        }
      } catch {
        logger.warn("Failed to parse trigger_config for visual workflow", { workflowId: row.id });
      }
    }

    if (matching.length === 0) {
      logger.debug("No visual workflows matched webhook", { webhookId });
      return;
    }

    logger.info("Triggering visual workflows by webhook", {
      webhookId,
      count: matching.length,
    });

    // Execute all matching workflows concurrently
    const results = await Promise.allSettled(
      matching.map((row) => executeVisualWorkflow(row.id, data)),
    );

    for (let i = 0; i < results.length; i++) {
      const result = results[i];
      const row = matching[i];
      if (result.status === "rejected") {
        logger.error("Webhook-triggered visual workflow failed", {
          workflowId: row.id,
          name: row.name,
          error: result.reason?.message ?? String(result.reason),
        });
      }
    }
  } catch (err: any) {
    logger.error("triggerByWebhook error", {
      webhookId,
      error: err?.message ?? String(err),
    });
  }
}
