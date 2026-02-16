# Zubo Roadmap

> What makes OpenClaw a 145k-star project: multi-LLM with failover, 14+ channels
> through one agent, a skills ecosystem, local-first gateway, and progressive
> onboarding. Zubo takes the same ideas but stays lean — no gateway daemon,
> no monorepo, just a single Bun process you can run anywhere.

---

## Phase 1 — Multi-LLM Provider System

**Goal:** Use any LLM — Claude, GPT, Ollama, LM Studio, Groq, Together — through
one config. Swap models without touching code.

### 1.1 OpenAI-Compatible Provider

The OpenAI chat completions API is the lingua franca. Ollama, LM Studio, Together,
Groq, and OpenRouter all expose it. One provider covers them all.

**Files:**

| File | Action |
|---|---|
| `src/llm/provider.ts` | Add `providerName` field to interface |
| `src/llm/openai-compat.ts` | **New.** OpenAI-compatible provider (no SDK — raw `fetch`) |
| `src/llm/claude.ts` | Add `providerName = "anthropic"` |

**`src/llm/openai-compat.ts` design:**

```ts
export class OpenAICompatProvider implements LlmProvider {
  providerName: string;

  constructor(opts: {
    name: string;          // "openai" | "ollama" | "groq" | "lmstudio" | ...
    baseUrl: string;       // "https://api.openai.com/v1" or "http://localhost:11434/v1"
    apiKey: string;        // or "ollama" for local
    model: string;         // "gpt-4o" | "llama3.3" | "qwen2.5-coder:32b"
    maxTokens?: number;
    streaming?: boolean;   // default true, false for Ollama tool-use bug
  })

  async chat(request: LlmRequest): Promise<LlmResponse> {
    // POST /chat/completions
    // Map LlmToolDef[] → OpenAI function format
    // Map response → LlmResponse (text + tool_use blocks)
  }
}
```

**Why raw fetch instead of the OpenAI SDK:** Fewer deps, works with every
OpenAI-compatible endpoint, and we control retry/timeout behavior.

### 1.2 Provider Factory + Config

Decide which provider to instantiate from config alone.

**Files:**

| File | Action |
|---|---|
| `src/config/schema.ts` | New `providers` + `activeModel` fields |
| `src/llm/factory.ts` | **New.** `createProvider(config) → LlmProvider` |
| `src/start.ts` | Use factory instead of hardcoded `new ClaudeProvider()` |
| `src/setup.ts` | Ask which provider during setup |

**Config shape:**

```jsonc
{
  // ... existing fields ...

  "providers": {
    "anthropic": {
      "apiKey": "sk-ant-...",
      "model": "claude-sonnet-4-5-20250929"
    },
    "openai": {
      "apiKey": "sk-...",
      "baseUrl": "https://api.openai.com/v1",
      "model": "gpt-4o"
    },
    "ollama": {
      "baseUrl": "http://localhost:11434/v1",
      "apiKey": "ollama",
      "model": "qwen2.5-coder:32b",
      "streaming": false
    },
    "groq": {
      "apiKey": "gsk_...",
      "baseUrl": "https://api.groq.com/openai/v1",
      "model": "llama-3.3-70b-versatile"
    }
  },

  "activeProvider": "anthropic",

  "failover": ["openai", "ollama"]  // optional fallback chain
}
```

**`src/llm/factory.ts` logic:**

```
1. Look up config.providers[config.activeProvider]
2. If provider name is "anthropic" → new ClaudeProvider(...)
3. Anything else → new OpenAICompatProvider({ name, baseUrl, apiKey, model })
4. Wrap in FailoverProvider if config.failover exists
```

### 1.3 Failover Wrapper

**File:** `src/llm/failover.ts` (new)

```ts
export class FailoverProvider implements LlmProvider {
  constructor(
    private primary: LlmProvider,
    private fallbacks: LlmProvider[],
  ) {}

  async chat(request: LlmRequest): Promise<LlmResponse> {
    try {
      return await this.primary.chat(request);
    } catch (err) {
      logger.warn(`Primary provider failed, trying fallback`, { error: err.message });
      for (const fb of this.fallbacks) {
        try { return await fb.chat(request); } catch {}
      }
      throw err; // all failed
    }
  }
}
```

### 1.4 Ollama Auto-Discovery (optional, nice-to-have)

**File:** `src/llm/ollama-discover.ts` (new)

```
GET http://localhost:11434/api/tags → list models
GET http://localhost:11434/api/show { name } → check tool support
Auto-populate config.providers.ollama.model with best available
```

Run during `bun run setup` if user picks Ollama — show available models and let
them choose.

### 1.5 `bun run model` CLI command

Quick model switching without editing config.json:

```bash
bun run model                    # show current model
bun run model ollama/llama3.3    # switch active provider+model
bun run model --list             # list configured providers
```

**File:** `src/model.ts` (new) + wire in `index.ts`

---

## Phase 2 — More Channels

**Goal:** Same agent on WhatsApp, Discord, and a local web UI. One memory,
one personality, many surfaces.

### 2.1 Channel Architecture Refinement

Current `ChannelAdapter` interface is already clean. We add:

**Files:**

| File | Action |
|---|---|
| `src/channels/adapter.ts` | Add `channelName`, `isGroup` to InboundMessage |
| `src/config/schema.ts` | Per-channel config section |

### 2.2 Discord Channel

**Dep:** `discord.js` or lighter `@discordjs/rest` + gateway

**File:** `src/channels/discord.ts` (new)

- Bot token from config
- Listen for mentions + DMs
- Group mode: only respond when @mentioned
- Message splitting for 2000-char limit

### 2.3 WhatsApp via Baileys

**Dep:** `@whiskeysockets/baileys` (no official API needed)

**File:** `src/channels/whatsapp.ts` (new)

- QR code pairing during setup
- Store auth state in `~/.zubo/channels/whatsapp/`
- Handle text messages, ignore media for now

### 2.4 WebChat (local HTTP UI)

**No deps.** Bun's built-in HTTP server + a single HTML file.

**Files:**
- `src/channels/webchat.ts` — HTTP server + SSE for streaming
- `src/channels/webchat.html` — Minimal chat UI (inline, no build step)

Serves on `http://localhost:3000`. Good for testing without Telegram.

### 2.5 Channel Router Improvements

**File:** `src/channels/router.ts`

- Register multiple adapters (not just one)
- Route replies to correct channel by `sessionKey` prefix
- Cross-channel session access (read Telegram history from WebChat)

---

## Phase 3 — Skills / Plugin System

**Goal:** Let users drop a folder into `~/.zubo/workspace/skills/` and the agent
gains new abilities. No code changes, no restart.

### 3.1 Skill Format

```
~/.zubo/workspace/skills/
  web-search/
    SKILL.md        # Description, when to use, tool schema
    handler.ts      # Bun-loadable module exporting tool handler
  weather/
    SKILL.md
    handler.ts
```

**SKILL.md example:**

```markdown
# Web Search

Search the web for current information.

## Tool: web_search
- query (string, required): Search query

## When to use
When the user asks about current events, prices, news, or anything
that requires up-to-date information beyond your training data.
```

**handler.ts contract:**

```ts
export default async function(input: Record<string, unknown>): Promise<string> {
  const { query } = input as { query: string };
  // ... do the thing ...
  return JSON.stringify(results);
}
```

### 3.2 Skill Loader

**File:** `src/tools/skill-loader.ts` (new)

```
1. Scan ~/.zubo/workspace/skills/*/
2. Parse each SKILL.md for tool name + schema + description
3. Dynamic import() each handler.ts
4. Register via existing registerTool()
```

Called at startup. Hot-reload on file change is a future nice-to-have.

### 3.3 Built-in Skills to Ship

| Skill | What it does |
|---|---|
| `web-search` | DuckDuckGo/Brave Search API |
| `url-fetch` | Fetch URL, convert to markdown, summarize |
| `shell` | Run shell command (with confirmation) |
| `file-read` | Read file from disk |
| `file-write` | Write file to disk |
| `http-request` | Generic HTTP request (GET/POST) |

These live in `src/tools/builtin/` but follow the same SKILL.md pattern
so users can override them.

---

## Phase 4 — Agent Improvements

**Goal:** Smarter agent loop — thinking, streaming, multi-agent delegation.

### 4.1 Streaming Responses

Stream tokens to the channel as they arrive instead of waiting for completion.

**Files:**
- `src/llm/provider.ts` — Add `chatStream()` returning `AsyncIterable<LlmChunk>`
- `src/llm/claude.ts` — Implement streaming via Anthropic SDK
- `src/llm/openai-compat.ts` — Implement SSE parsing
- `src/agent/loop.ts` — Stream-aware loop
- `src/channels/telegram.ts` — Edit message in-place as tokens arrive

### 4.2 Extended Thinking / Reasoning

For models that support it (Claude with extended thinking, DeepSeek-R1, QwQ):

- Detect `thinking` blocks in response
- Don't send thinking to user (unless asked)
- Use thinking for better tool-use decisions
- Config toggle: `thinking: true/false` per provider

### 4.3 Cost + Token Tracking

**File:** `src/agent/usage.ts` (new)

- Track per-message input/output tokens
- Track per-session cumulative cost
- Store in DB (new `usage` table)
- Surface in `bun run status`

```sql
CREATE TABLE usage (
  id INTEGER PRIMARY KEY,
  session_key TEXT,
  provider TEXT,
  model TEXT,
  input_tokens INTEGER,
  output_tokens INTEGER,
  cost_usd REAL,
  created_at TEXT DEFAULT (datetime('now'))
);
```

### 4.4 Context Window Awareness

Different models have different context windows. Compaction should respect this.

**File:** `src/agent/compaction.ts`

- Provider reports `contextWindow` size
- Compaction targets 66% of that (not hardcoded 100k)
- Small local models (8k context) get aggressive compaction

---

## Phase 5 — Proactive Agent + Automation

**Goal:** Zubo doesn't just respond — it acts on its own.

### 5.1 Webhook Inbound

**File:** `src/scheduler/webhooks.ts` (new)

- Bun HTTP server on configurable port
- Routes like `POST /webhook/:name` → trigger agent with payload
- Use case: GitHub push → Zubo summarizes commit
- Use case: IFTTT/Zapier integration

### 5.2 Agent-Managed Cron

Let the agent create/edit/delete cron jobs via tools (not just DB):

**New tools:**
- `cron_create` — Create a scheduled task
- `cron_list` — List all cron jobs
- `cron_delete` — Remove a job

Now the user can say "remind me every Monday at 9am to review PRs" and the
agent handles it end-to-end.

### 5.3 Daily Digest

A built-in cron job (opt-in) that:

1. Reads recent memories from the past 24h
2. Checks calendar/weather (if skills installed)
3. Composes a morning briefing
4. Sends to user's primary channel

---

## Phase 6 — Security + Permissions

### 6.1 Tool Approval

Some tools are dangerous (shell, file-write). Before executing:

```
Agent wants to run: shell("rm -rf /tmp/old-data")
[Approve] [Deny] [Always allow shell]
```

**File:** `src/tools/permissions.ts` (new)

- Permission levels: `auto` (memory_search), `confirm` (shell), `deny`
- Per-tool config in `~/.zubo/workspace/PERMISSIONS.md` or config.json
- Channel adapters render approval buttons (Telegram inline keyboard)

### 6.2 Message Pairing / Auth

For channels where anyone can message the bot:

- First message from unknown user → pairing code
- User must confirm in a trusted channel (or CLI)
- Prevents prompt injection from strangers

---

## Phase 7 — Companion Interfaces

### 7.1 TUI (Terminal UI)

**File:** `src/channels/tui.ts` (new)

Interactive terminal chat using Bun's readline or `ink`:

```bash
bun run chat
```

Full chat experience without any external service. Best for testing and
local-only use. Essential for Ollama-only setups where you don't need Telegram.

### 7.2 Web Dashboard

**Files:**
- `src/dashboard/server.ts` — Bun HTTP server
- `src/dashboard/index.html` — Single-page app

Shows:
- Live conversation view
- Memory browser (search + edit)
- Cron job management
- Provider/model status
- Usage/cost charts

---

## Completed

Most phases above are now implemented:

- Phase 1 (Multi-LLM) — 11+ providers, failover, smart routing, CLI providers (Codex, Claude Code)
- Phase 2 (Channels) — Telegram, Discord, Slack, WhatsApp, Signal, Email, WebChat
- Phase 3 (Skills) — Skill loader, sandboxed execution, community registry, MCP support
- Phase 4 (Agent) — Streaming, cost tracking, context window awareness, knowledge graph
- Phase 5 (Automation) — Webhooks, agent-managed cron, daily digests, follow-ups
- Phase 6 (Security) — Tool permissions (auto/confirm/deny), confirmation tokens, API key auth
- Phase 7 (Interfaces) — Web dashboard with analytics, memory, skills, settings, and personal tools (todos, notes, preferences, topics, follow-ups)
- Personal features — Todos, notes, preferences, topics, follow-ups with full CRUD in the dashboard
