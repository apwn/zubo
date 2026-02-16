import { loadSession } from "./session";
import { buildSystemPrompt } from "./prompts";
import type { LlmMessage } from "../llm/provider";

export interface AgentContext {
  system: string;
  messages: LlmMessage[];
}

export async function assembleContext(
  sessionId: string,
  maxTurns: number = 50,
  memories: string = ""
): Promise<AgentContext> {
  const messages = loadSession(sessionId, maxTurns);
  const system = await buildSystemPrompt(memories);
  return { system, messages };
}
