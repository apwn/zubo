import type { LlmProvider } from "../llm/provider";
import { getAgentDefinition } from "./agents";
import { agentLoop } from "./loop";
import { searchMemory } from "../memory/engine";
import { getDb } from "../db/connection";
import { logger } from "../util/logger";

const MAX_DELEGATION_DEPTH = 2;
let currentDelegationDepth = 0;

/**
 * Delegate a task to a named sub-agent.
 * The sub-agent runs with its own system prompt and scoped tools,
 * but shares memory with the main agent. Conversation history is separate.
 */
export async function delegateToAgent(
  llm: LlmProvider,
  agentName: string,
  task: string
): Promise<string> {
  if (currentDelegationDepth >= MAX_DELEGATION_DEPTH) {
    return `Error: Maximum delegation depth (${MAX_DELEGATION_DEPTH}) reached. Cannot delegate further.`;
  }

  const agent = getAgentDefinition(agentName);
  if (!agent) {
    return `Error: Agent "${agentName}" not found. Use manage_agents to create it first.`;
  }

  logger.info(`Delegating to agent "${agentName}": ${task}`);

  // Search memory for context relevant to the task
  let memories = "";
  try {
    const db = getDb();
    const results = searchMemory(db, task, 3);
    if (results.length > 0) {
      memories = results.map((r) => r.content).join("\n\n");
    }
  } catch {
    // Memory search may fail if not initialized; continue without it
  }

  // Build system prompt for the sub-agent
  const now = new Date().toISOString();
  let systemPrompt = agent.systemPrompt;
  systemPrompt += `\n\nCurrent time: ${now}`;
  if (memories) {
    systemPrompt += `\n\n## Relevant memories\n${memories}`;
  }

  // Use a separate session for each agent
  const sessionId = `agent:${agentName}`;

  currentDelegationDepth++;
  try {
    const result = await agentLoop(llm, sessionId, task, {
      systemPromptOverride: systemPrompt,
      allowedTools: agent.tools.length > 0 ? agent.tools : undefined,
      maxRounds: 8,
      memories,
    });

    return result.reply;
  } finally {
    currentDelegationDepth--;
  }
}
