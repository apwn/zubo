<p align="center">
  <img src="https://raw.githubusercontent.com/apwn/zubo/main/site/logo.svg" width="80" height="80" alt="Zubo">
</p>

<h1 align="center">Zubo</h1>

<p align="center">
  <strong>Your AI agent that never forgets.</strong><br>
  Persistent memory, 25+ tools, 7 channels, 11+ LLM providers — runs entirely on your machine.
</p>

<p align="center">
  <a href="https://zubo.bot">Website</a> &nbsp;&middot;&nbsp;
  <a href="https://zubo.bot/docs/">Documentation</a> &nbsp;&middot;&nbsp;
  <a href="https://zubo.bot/skills.html">Community Skills</a>
</p>

<p align="center">
  <img src="https://img.shields.io/badge/license-MIT-7c3aed" alt="MIT License">
  <img src="https://img.shields.io/badge/runtime-Bun-f472b6" alt="Bun">
  <img src="https://img.shields.io/badge/lang-TypeScript-3178c6" alt="TypeScript">
  <img src="https://img.shields.io/badge/storage-SQLite-003B57" alt="SQLite">
</p>

---

## Features

- **11+ LLM providers** — Anthropic, OpenAI, Ollama, Groq, Together, OpenRouter, DeepSeek, xAI, Fireworks, LM Studio, Cerebras, MiniMax, and any OpenAI-compatible endpoint. Smart routing sends simple queries to fast models automatically.
- **7 channels** — Telegram, Discord, Slack, WhatsApp, Signal, Email, Web Chat
- **Persistent memory** — Vector + full-text hybrid search with ONNX embeddings and FTS5. Remembers every conversation, preference, and fact — forever.
- **Memory explainability** — Memory matches include confidence and why they were selected (keyword, semantic, or hybrid match).
- **25+ built-in tools** — Web search (Brave + DuckDuckGo), file ops, code execution, APIs, sub-agent delegation, knowledge graph, memory pruning, reminders, and automatic failover between providers.
- **Extensible skills** — Build custom skills in TypeScript. Share them on the registry. Install community skills with one command.
- **9 integrations** — GitHub, Google (Gmail, Calendar, Docs, Drive, Sheets), Notion, Linear, Jira, Slack, Twitter + Claude Code and MCP
- **Workflows** — Multi-agent pipelines with delegation
- **Natural language scheduling** — "Every weekday at 9am" just works. Cron jobs, heartbeat, proactive tasks.
- **Voice** — Speech-to-text (Whisper, local whisper.cpp), text-to-speech (OpenAI, ElevenLabs), and continuous voice conversation mode
- **Personal tools** — Todos, notes, preferences, topics, and follow-ups — all manageable from the dashboard or via chat
- **Dashboard** — Built-in web UI with analytics, memory management, Ollama model manager, personal tools, and settings
- **Safety controls** — Tool scope allowlists and dry-run-by-default mode for risky tools, configurable in the dashboard
- **Document ingestion** — Upload PDF, DOCX, XLSX, PPTX, TXT, CSV, JSON, and more
- **Budget controls** — Daily/monthly spending limits with per-model cost tracking
- **100% local** — SQLite database, local vector store. Your data never leaves your machine.

## Quick Start

```bash
curl -fsSL https://zubo.bot/install.sh | bash
```

Or install via package manager:

```bash
bun add -g zubo    # recommended
npm i -g zubo      # also works
```

Then:

```bash
zubo setup         # interactive config wizard (terminal or browser)
zubo start         # launch the agent
```

The web dashboard opens automatically at `http://localhost:<port>`.

## First 10 Minutes

1. Open Chat and type `/help`.
2. Ask a real task: "Summarize my latest git changes" or "Plan my week."
3. Open Settings:
   - `AI Model` to choose provider/model
   - `Action Safety` to control allowed actions
   - `Memory in Replies` to tune how much context is reused
4. If replies fail, check:
   - `Settings > API Keys` for auth errors
   - `Settings > AI Model` for missing model errors
   - Local model users: run `ollama serve` and pull the model first

## Architecture

```
User Message
  → Channel (Telegram / Discord / Slack / WhatsApp / Signal / WebChat)
    → Message Router
      → Agent Loop (LLM + Tool Execution)
        → Tools (built-in, skills, integrations)
        → Memory (vector search, FTS5, document parsing)
        → Scheduler (cron, heartbeat, proactive tasks)
      → Response
    → Channel
  → User
```

## Configuration

All config lives in `~/.zubo/config.json`. Run `zubo setup` for interactive configuration, or set values directly:

```bash
zubo config set activeProvider anthropic
zubo config set smartRouting.enabled true
zubo config set budget.monthlyLimitUsd 50
```

See the full [configuration reference](https://zubo.bot/docs/config.html) for all options.

## Channels

| Channel | Setup |
|---------|-------|
| **Web Chat** | Enabled by default |
| **Telegram** | Add `channels.telegram.botToken` from [@BotFather](https://t.me/BotFather) |
| **Discord** | Add `channels.discord.botToken` from [Developer Portal](https://discord.com/developers) |
| **Slack** | Add `channels.slack.botToken` + `appToken` (Socket Mode) |
| **WhatsApp** | Add `channels.whatsapp`, authenticate via QR |
| **Email** | Add `channels.email` with IMAP/SMTP settings |
| **Signal** | Install signal-cli, add `channels.signal.phoneNumber` |

## Integrations

| Service | Capabilities | Secret |
|---------|-------------|--------|
| GitHub | Issues, PRs, Repos | `github_token` |
| Google | Gmail, Calendar, Docs, Drive, Sheets | `google_api_key` |
| Notion | Pages, Databases, Search | `notion_token` |
| Linear | Issues, Projects | `linear_token` |
| Jira | Issues, Boards | `jira_token` |
| Slack | Messages | `slack_token` |
| Twitter | Posts, Timeline, Search | `twitter_bearer_token` |

Set secrets through natural conversation: *"Set my github_token to ghp_..."*

## CLI

```
zubo setup                 Interactive configuration wizard (terminal or browser)
zubo start [--daemon]      Start the agent
zubo stop                  Stop the background daemon
zubo status                Show runtime status
zubo logs [--follow]       View or stream logs
zubo model [provider/model] Show or switch LLM
zubo skills                Manage skills
zubo install <name>        Install from registry
zubo search <query>        Search the registry
zubo voice                 Continuous voice conversation mode
zubo eval                  Run reliability + safety checks
zubo auth create-key       Create an API key
zubo export / import       Backup and restore
```

Full reference at [zubo.bot/docs/cli.html](https://zubo.bot/docs/cli.html).

## Unified Slash Commands

Across WebChat, Telegram, Discord, Slack, and other channels:

- Basic:
  - `/help` — quick command menu + docs link
  - `/status` — runtime status
  - `/memory <query>` — search saved memory
  - `/model` — show current provider/model
  - `/model set <provider/model>` — switch active model at runtime
- Advanced:
  - `/tools [filter]` — list available tools
  - `/permissions <tool>` — view tool permission + scopes
  - `/permissions set <tool> <auto|confirm|deny>` — override tool permission
  - `/budget` — view budget usage and limits
  - `/budget pause|resume` — pause/resume budget enforcement

## Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Run `npx tsc --noEmit` and `bun test`
5. Submit a pull request

## License

MIT

---

Created by [@thomaskanze](https://x.com/thomaskanze)
