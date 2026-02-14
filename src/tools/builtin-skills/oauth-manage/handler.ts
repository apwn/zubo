/**
 * OAuth management skill — lets the LLM manage OAuth connections.
 *
 * Actions:
 *   list       — list all connections and their status
 *   connect    — generate an auth URL for a provider
 *   disconnect — revoke a provider's tokens
 *   status     — check status of a specific provider
 */

import {
  listConnections,
  getAuthUrl,
  revokeToken,
  getToken,
  isProviderConfigured,
  listSupportedProviders,
} from "../../oauth";

export default async function (input: Record<string, unknown>): Promise<string> {
  const action = input.action as string;
  const provider = input.provider as string | undefined;

  switch (action) {
    case "list": {
      const connections = listConnections();
      const supported = listSupportedProviders();
      return JSON.stringify({
        action: "list",
        supported_providers: supported,
        connections: connections.map((c) => ({
          provider: c.provider,
          connected: c.connected,
          token_valid: c.token_valid,
          expires_at: c.expires_at,
          scope: c.scope,
          configured: isProviderConfigured(c.provider),
        })),
      });
    }

    case "connect": {
      if (!provider) {
        return JSON.stringify({
          error: "provider is required for connect action",
          supported: listSupportedProviders(),
        });
      }

      if (!isProviderConfigured(provider)) {
        return JSON.stringify({
          error: `OAuth is not configured for "${provider}". Add oauth.providers.${provider}.clientId and clientSecret to your zubo config file.`,
          setup_guide: `Add the following to your config.json:\n\n"oauth": {\n  "providers": {\n    "${provider}": {\n      "clientId": "YOUR_CLIENT_ID",\n      "clientSecret": "YOUR_CLIENT_SECRET"\n    }\n  }\n}`,
        });
      }

      // Determine the callback URL — use the webchat server port
      let callbackPort = 0;
      try {
        const { readFileSync } = require("fs");
        const { paths } = require("../../../config/paths");
        const config = JSON.parse(readFileSync(paths.config, "utf-8"));
        callbackPort = config.channels?.webchat?.port ?? 0;
      } catch {}

      // If port is 0, Bun assigns a random port. We need to detect the actual port.
      // The webchat adapter stores this internally. For the tool, we'll use the
      // standard approach: construct the redirect URI.
      const baseUrl = callbackPort
        ? `http://localhost:${callbackPort}`
        : "http://localhost:3000";

      const redirectUri = `${baseUrl}/oauth/${provider}/callback`;

      try {
        const { url } = await getAuthUrl(provider, redirectUri);
        return JSON.stringify({
          action: "connect",
          provider,
          auth_url: url,
          instructions: `Open this URL in your browser to authorize ${provider}. After authorizing, you will be redirected back automatically.`,
        });
      } catch (err: any) {
        return JSON.stringify({ error: err.message });
      }
    }

    case "disconnect": {
      if (!provider) {
        return JSON.stringify({
          error: "provider is required for disconnect action",
          supported: listSupportedProviders(),
        });
      }

      try {
        const removed = await revokeToken(provider);
        if (removed) {
          return JSON.stringify({
            action: "disconnect",
            provider,
            success: true,
            message: `${provider} has been disconnected. OAuth tokens have been removed.`,
          });
        }
        return JSON.stringify({
          action: "disconnect",
          provider,
          success: false,
          message: `No stored tokens found for ${provider}. It may not have been connected.`,
        });
      } catch (err: any) {
        return JSON.stringify({ error: err.message });
      }
    }

    case "status": {
      if (!provider) {
        return JSON.stringify({
          error: "provider is required for status action",
          supported: listSupportedProviders(),
        });
      }

      const configured = isProviderConfigured(provider);
      let connected = false;
      let tokenValid = false;

      try {
        const token = await getToken(provider);
        if (token) {
          connected = true;
          tokenValid = true;
        }
      } catch {}

      return JSON.stringify({
        action: "status",
        provider,
        configured,
        connected,
        token_valid: tokenValid,
        message: connected
          ? `${provider} is connected and the token is ${tokenValid ? "valid" : "expired"}.`
          : configured
            ? `${provider} is configured but not connected. Use the connect action to authorize.`
            : `${provider} is not configured. Add OAuth credentials to your zubo config.`,
      });
    }

    default:
      return JSON.stringify({
        error: `Unknown action: "${action}". Use list, connect, disconnect, or status.`,
      });
  }
}
