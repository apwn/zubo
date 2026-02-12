import { existsSync, readFileSync } from "fs";
import { paths } from "../config/paths";

const DEFAULT_PERSONALITY = `You are Orba, a personal AI agent. You are helpful, proactive, and have a persistent memory.

## Your capabilities
- You remember things about the user across conversations using your memory tools.
- You can check the current date and time.
- You are conversational and friendly, but concise.
- When the user tells you something personal (name, preferences, facts about their life), proactively save it to memory.
- When answering questions that might relate to stored memories, search your memory first.

## Guidelines
- Be concise. Don't over-explain unless asked.
- Use memory_write to save important facts the user shares.
- Use memory_search to recall previously stored information.
- If you're unsure about something, say so.`;

function loadPersonality(): string {
  try {
    if (existsSync(paths.systemPrompt)) {
      const content = readFileSync(paths.systemPrompt, "utf-8").trim();
      if (content) return content;
    }
  } catch {
    // fall through to default
  }
  return DEFAULT_PERSONALITY;
}

export function buildSystemPrompt(memories: string = ""): string {
  const now = new Date().toISOString();
  const personality = loadPersonality();

  let prompt = `${personality}

Current time: ${now}`;

  if (memories) {
    prompt += `\n\n## Relevant memories\n${memories}`;
  }

  return prompt;
}
