# Zubo

A personal AI agent that remembers you, runs tasks, and connects to your favorite services. Built with Bun, TypeScript, and SQLite.

## Features

- **Multi-provider LLM** — Claude, OpenAI-compatible, with automatic failover
- **Multi-channel** — Telegram, Discord, Slack, WhatsApp, Signal, Web Chat
- **Persistent memory** — Vector + full-text hybrid search (ONNX embeddings, FTS5)
- **Tool system** — Built-in tools, extensible skills, skill registry
- **Integrations** — GitHub, Google (Gmail, Calendar, Docs, Drive, Sheets), Notion, Linear, Jira, Slack, Twitter
- **Workflows** — Multi-agent pipelines with delegation
- **Scheduling** — Cron jobs, heartbeat, proactive tasks
- **Voice** — Speech-to-text (Whisper) and text-to-speech (OpenAI, ElevenLabs)
- **Dashboard** — Built-in web UI with analytics, memory management, and settings
- **Document ingestion** — Upload PDF, DOCX, TXT, CSV, JSON, and more
- **API authentication** — Bearer token auth with key management
- **Rate limiting** — Per-IP sliding window protection
- **Skill sandboxing** — User-installed skills run in isolated subprocesses
- **Database backup** — Export/import JSON, atomic SQLite backups

## Quick Start

```bash
# 1. Install dependencies
bun install

# 2. Run interactive setup
bun run setup

# 3. Start the agent
bun run start
```

The web dashboard will be available at `http://localhost:<port>` (shown in terminal output).

## Architecture

```
User Message
  → Channel Adapter (Telegram/Discord/Slack/WhatsApp/Signal/WebChat)
    → Message Router
      → Agent Loop (LLM + Tool Execution)
        → Tools (built-in, skills, integrations)
        → Memory (vector search, FTS5, document parsing)
        → Scheduler (cron, heartbeat, proactive tasks)
      → Response
    → Channel Adapter
  → User
```

## Configuration

Configuration is stored in `~/.zubo/config.json`. Key fields:

| Field | Description |
|---|---|
| `providers` | LLM provider configs (API key, model, base URL) |
| `activeProvider` | Which provider to use |
| `failover` | Provider failover chain |
| `channels` | Channel-specific settings |
| `voice` | STT/TTS provider configuration |
| `maxTurns` | Max agent loop turns (default: 50) |
| `heartbeatMinutes` | Background heartbeat interval (default: 30) |
| `auth.enabled` | Enable API key authentication |
| `rateLimit.chatPerMinute` | Chat rate limit (default: 60) |
| `rateLimit.uploadPerMinute` | Upload rate limit (default: 10) |
| `sandbox.enabled` | Enable skill sandboxing (default: true) |
| `sandbox.timeoutMs` | Sandbox timeout (default: 30000) |

## Channel Setup

### Web Chat
Enabled by default. Configure port in `channels.webchat.port`.

### Telegram
1. Create a bot via [@BotFather](https://t.me/BotFather)
2. Add `channels.telegram.botToken` to config
3. Optionally restrict with `channels.telegram.allowedUsers` (user IDs)

### Discord
1. Create a bot at [Discord Developer Portal](https://discord.com/developers)
2. Enable Message Content Intent
3. Add `channels.discord.botToken` to config

### Slack
1. Create a Slack app with Socket Mode enabled
2. Add `channels.slack.botToken` and `channels.slack.appToken` to config

### WhatsApp
1. Add `channels.whatsapp` to config
2. Authenticate via QR code on first run

### Signal
1. Install signal-cli
2. Register a phone number
3. Add `channels.signal.phoneNumber` to config

## Integrations

Install integrations via the dashboard or CLI:

| Service | Skills | Secret |
|---|---|---|
| GitHub | Issues, PRs, Repos | `github_token` |
| Google | Gmail, Calendar, Docs, Drive, Sheets | `google_api_key` |
| Notion | Pages, Databases, Search | `notion_token` |
| Linear | Issues, Projects | `linear_token` |
| Jira | Issues, Boards | `jira_token` |
| Slack | Messages | `slack_token` |
| Twitter | Posts | `twitter_bearer_token` |

Set secrets via the agent: `"Set my github_token to ghp_..."`

## CLI Reference

```
zubo setup              Configure API keys and channels
zubo start              Start the agent
zubo start --daemon     Start in background
zubo stop               Stop the daemon
zubo status             Show config and runtime status
zubo logs               Show last 50 log lines
zubo logs --follow      Stream logs live
zubo model              Show active LLM provider/model
zubo model <p/m>        Switch provider/model
zubo model --list       List configured providers
zubo skills             Manage skills (interactive)
zubo skills list        List installed skills
zubo skills new         Create a new skill
zubo install <skill>    Install from registry
zubo search <query>     Search the skill registry
zubo publish            Publish a skill
zubo auth create-key    Create an API key
zubo auth list-keys     List API keys
zubo export             Export database as JSON
zubo import <path>      Import database from JSON
```

## Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Run `npx tsc --noEmit` and `bun test`
5. Submit a pull request

## License

MIT
