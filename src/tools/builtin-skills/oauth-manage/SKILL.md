# oauth_manage

Manage OAuth connections for third-party integrations (Google, GitHub, Notion, Linear, Slack).

## Parameters

- **action** (required): `list`, `connect`, `disconnect`, `status`
- **provider**: The provider name (google, github, notion, linear, slack). Required for `connect`, `disconnect`, and `status`.

## Actions

- `list` — Show all OAuth connections and their status
- `connect` — Generate an authorization URL for the user to connect a provider. Returns a URL the user should open in their browser.
- `disconnect` — Revoke and remove stored OAuth tokens for a provider
- `status` — Check the connection status of a specific provider
