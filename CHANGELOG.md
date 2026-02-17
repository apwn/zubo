# Changelog

## 0.1.25 - 2026-02-17

- Added `zubo eval` reliability command with deterministic checks for slash commands, memory explainability, and dry-run safety.
- Added unified slash command write-actions:
  - `/model set <provider/model>`
  - `/permissions set <tool> <auto|confirm|deny>`
  - `/budget pause|resume`
- Added configurable memory retrieval tuning:
  - `memoryRetrieval.contextTopK`
  - `memoryRetrieval.minConfidence`
- Added configurable runtime tool policy controls:
  - `toolScopes.allowed`
  - `toolScopes.dryRunByDefault`
  - `toolPermissions.<tool>`
- Updated dashboard settings UI with memory retrieval and tool safety controls, including preset buttons and inline guidance.
- Improved memory explainability display in dashboard and memory search outputs (match type, confidence, reasons).
- Updated front-facing docs (`README`, CLI, config, memory docs) for new commands and settings.
- Added CI gate for `zubo eval`.
