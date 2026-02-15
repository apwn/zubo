/**
 * OAuth 2.0 Authorization Code engine.
 *
 * Handles the full OAuth lifecycle for multiple providers:
 *   - Authorization URL generation with CSRF-safe state parameter
 *   - Authorization code exchange for access + refresh tokens
 *   - Token storage in SQLite (oauth_tokens table)
 *   - Automatic token refresh when expired
 *   - PKCE support (SHA-256 code challenge)
 *   - Graceful degradation: if OAuth is not configured, callers fall back to API keys
 */

import { getDb } from "../db/connection";
import { logger } from "../util/logger";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface OAuthProviderConfig {
  authUrl: string;
  tokenUrl: string;
  revokeUrl?: string;
  scopes: string[];
  clientId: string;
  clientSecret: string;
  /** Extra query params to include in the authorization URL */
  extraAuthParams?: Record<string, string>;
  /** Whether this provider supports PKCE (default: false) */
  usePkce?: boolean;
}

export interface StoredToken {
  provider: string;
  access_token: string;
  refresh_token: string | null;
  token_type: string;
  expires_at: string | null;
  scope: string | null;
  created_at: string;
  updated_at: string;
}

export interface OAuthConnectionStatus {
  provider: string;
  connected: boolean;
  expires_at: string | null;
  scope: string | null;
  token_valid: boolean;
}

// ---------------------------------------------------------------------------
// In-memory state store for CSRF / PKCE
// ---------------------------------------------------------------------------

interface PendingState {
  provider: string;
  redirectUri: string;
  codeVerifier?: string; // PKCE
  createdAt: number;
}

/** Pending OAuth states. Entries expire after 10 minutes. */
const pendingStates = new Map<string, PendingState>();
const STATE_TTL_MS = 10 * 60 * 1000; // 10 minutes

function cleanExpiredStates(): void {
  const now = Date.now();
  for (const [state, entry] of pendingStates) {
    if (now - entry.createdAt > STATE_TTL_MS) {
      pendingStates.delete(state);
    }
  }
}

// ---------------------------------------------------------------------------
// Provider definitions
// ---------------------------------------------------------------------------

const BUILTIN_PROVIDERS: Record<string, Omit<OAuthProviderConfig, "clientId" | "clientSecret">> = {
  google: {
    authUrl: "https://accounts.google.com/o/oauth2/v2/auth",
    tokenUrl: "https://oauth2.googleapis.com/token",
    revokeUrl: "https://oauth2.googleapis.com/revoke",
    scopes: [
      "https://www.googleapis.com/auth/gmail.modify",
      "https://www.googleapis.com/auth/calendar",
      "https://www.googleapis.com/auth/spreadsheets",
      "https://www.googleapis.com/auth/documents",
      "https://www.googleapis.com/auth/drive",
    ],
    extraAuthParams: {
      access_type: "offline",
      prompt: "consent",
    },
  },
  notion: {
    authUrl: "https://api.notion.com/v1/oauth/authorize",
    tokenUrl: "https://api.notion.com/v1/oauth/token",
    scopes: [],
    extraAuthParams: {
      owner: "user",
    },
  },
  linear: {
    authUrl: "https://linear.app/oauth/authorize",
    tokenUrl: "https://api.linear.app/oauth/token",
    revokeUrl: "https://api.linear.app/oauth/revoke",
    scopes: ["read", "write", "issues:create"],
    usePkce: false,
  },
  github: {
    authUrl: "https://github.com/login/oauth/authorize",
    tokenUrl: "https://github.com/login/oauth/access_token",
    scopes: ["repo", "read:user"],
  },
  slack: {
    authUrl: "https://slack.com/oauth/v2/authorize",
    tokenUrl: "https://slack.com/api/oauth.v2.access",
    revokeUrl: "https://slack.com/api/auth.revoke",
    scopes: [
      "channels:read",
      "channels:history",
      "chat:write",
      "search:read",
      "users:read",
    ],
  },
};

// ---------------------------------------------------------------------------
// Config loading
// ---------------------------------------------------------------------------

let _configCache: Record<string, OAuthProviderConfig> | null = null;
let _configCacheTime = 0;
const CONFIG_TTL = 30_000;

/**
 * Load OAuth provider configs from zubo config file.
 * Merges user-supplied clientId/clientSecret with built-in provider endpoints.
 */
function loadProviderConfigs(): Record<string, OAuthProviderConfig> {
  const now = Date.now();
  if (_configCache && now - _configCacheTime < CONFIG_TTL) return _configCache;

  _configCache = {};
  _configCacheTime = now;

  try {
    const { readFileSync } = require("fs");
    const { paths } = require("../config/paths");
    const config = JSON.parse(readFileSync(paths.config, "utf-8"));
    const oauthCfg = config.oauth?.providers ?? {};

    for (const [name, builtin] of Object.entries(BUILTIN_PROVIDERS)) {
      const userCfg = oauthCfg[name] as
        | { clientId?: string; clientSecret?: string; scopes?: string[] }
        | undefined;

      if (userCfg?.clientId && userCfg?.clientSecret) {
        _configCache[name] = {
          ...builtin,
          clientId: userCfg.clientId,
          clientSecret: userCfg.clientSecret,
          scopes: userCfg.scopes ?? builtin.scopes,
        };
      }
    }
  } catch (err: any) {
    logger.warn("Failed to load OAuth config", { error: err.message });
  }

  return _configCache;
}

/**
 * Check whether a specific provider has OAuth configured.
 */
export function isProviderConfigured(provider: string): boolean {
  return !!loadProviderConfigs()[provider];
}

/**
 * List all provider names that have built-in support.
 */
export function listSupportedProviders(): string[] {
  return Object.keys(BUILTIN_PROVIDERS);
}

// ---------------------------------------------------------------------------
// PKCE helpers
// ---------------------------------------------------------------------------

function generateCodeVerifier(): string {
  const array = new Uint8Array(32);
  crypto.getRandomValues(array);
  return btoa(String.fromCharCode(...array))
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/, "");
}

async function generateCodeChallenge(verifier: string): Promise<string> {
  const encoder = new TextEncoder();
  const data = encoder.encode(verifier);
  const hash = await crypto.subtle.digest("SHA-256", data);
  return btoa(String.fromCharCode(...new Uint8Array(hash)))
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/, "");
}

// ---------------------------------------------------------------------------
// Core API
// ---------------------------------------------------------------------------

/**
 * Generate the authorization URL for a provider.
 * Returns the URL the user should be redirected to.
 */
export async function getAuthUrl(
  provider: string,
  redirectUri: string
): Promise<{ url: string; state: string }> {
  const configs = loadProviderConfigs();
  const cfg = configs[provider];
  if (!cfg) {
    throw new Error(
      `OAuth provider "${provider}" is not configured. Add oauth.providers.${provider}.clientId and clientSecret to your zubo config.`
    );
  }

  cleanExpiredStates();

  const state = crypto.randomUUID();
  const pending: PendingState = {
    provider,
    redirectUri,
    createdAt: Date.now(),
  };

  const params = new URLSearchParams({
    client_id: cfg.clientId,
    redirect_uri: redirectUri,
    response_type: "code",
    state,
  });

  // Scopes
  if (cfg.scopes.length > 0) {
    // Slack uses comma-separated scopes in the 'scope' param for v2
    if (provider === "slack") {
      params.set("scope", cfg.scopes.join(","));
    } else {
      params.set("scope", cfg.scopes.join(" "));
    }
  }

  // PKCE
  if (cfg.usePkce) {
    const verifier = generateCodeVerifier();
    const challenge = await generateCodeChallenge(verifier);
    params.set("code_challenge", challenge);
    params.set("code_challenge_method", "S256");
    pending.codeVerifier = verifier;
  }

  // Extra params
  if (cfg.extraAuthParams) {
    for (const [k, v] of Object.entries(cfg.extraAuthParams)) {
      params.set(k, v);
    }
  }

  pendingStates.set(state, pending);

  return {
    url: `${cfg.authUrl}?${params.toString()}`,
    state,
  };
}

/**
 * Handle the OAuth callback: exchange the authorization code for tokens.
 */
export async function handleCallback(
  provider: string,
  code: string,
  state: string
): Promise<{ success: boolean; provider: string; scope?: string }> {
  cleanExpiredStates();

  const pending = pendingStates.get(state);
  if (!pending) {
    throw new Error("Invalid or expired OAuth state parameter. Please restart the authorization flow.");
  }

  if (pending.provider !== provider) {
    throw new Error(`State mismatch: expected provider "${pending.provider}", got "${provider}".`);
  }

  pendingStates.delete(state);

  const configs = loadProviderConfigs();
  const cfg = configs[provider];
  if (!cfg) {
    throw new Error(`OAuth provider "${provider}" is not configured.`);
  }

  // Build token exchange request
  const body: Record<string, string> = {
    grant_type: "authorization_code",
    code,
    redirect_uri: pending.redirectUri,
    client_id: cfg.clientId,
    client_secret: cfg.clientSecret,
  };

  if (pending.codeVerifier) {
    body.code_verifier = pending.codeVerifier;
  }

  const headers: Record<string, string> = {
    "Content-Type": "application/x-www-form-urlencoded",
    Accept: "application/json",
  };

  // Notion uses Basic auth for the token endpoint
  if (provider === "notion") {
    const credentials = Buffer.from(`${cfg.clientId}:${cfg.clientSecret}`).toString("base64");
    headers["Authorization"] = `Basic ${credentials}`;
    // Notion does not want client_id/client_secret in the body
    delete body.client_id;
    delete body.client_secret;
    // Notion expects JSON body
    headers["Content-Type"] = "application/json";
  }

  let res: Response;
  if (provider === "notion") {
    res = await fetch(cfg.tokenUrl, {
      method: "POST",
      headers,
      body: JSON.stringify(body),
    });
  } else {
    res = await fetch(cfg.tokenUrl, {
      method: "POST",
      headers,
      body: new URLSearchParams(body),
    });
  }

  if (!res.ok) {
    const errBody = await res.text().catch(() => "");
    logger.error(`[OAuth] Token exchange failed for ${provider}`, {
      status: res.status,
      body: errBody.slice(0, 500),
    });
    throw new Error(
      `Token exchange failed for ${provider} (${res.status}). Please try again.`
    );
  }

  const data = await res.json() as Record<string, any>;

  // Normalize response — different providers use different field names
  const accessToken = data.access_token;
  const refreshToken = data.refresh_token ?? null;
  const tokenType = data.token_type ?? "Bearer";
  const expiresIn = data.expires_in ? Number(data.expires_in) : null;
  const scope = data.scope ?? null;

  if (!accessToken) {
    throw new Error(`No access_token returned by ${provider}.`);
  }

  // Compute absolute expiry time
  const expiresAt = expiresIn
    ? new Date(Date.now() + expiresIn * 1000).toISOString()
    : null;

  // Store in DB
  storeToken(provider, {
    access_token: accessToken,
    refresh_token: refreshToken,
    token_type: tokenType,
    expires_at: expiresAt,
    scope,
  });

  logger.info(`[OAuth] Successfully connected ${provider}`);

  return { success: true, provider, scope };
}

/** In-flight refresh promises to prevent concurrent refresh races */
const refreshLocks = new Map<string, Promise<string>>();

/**
 * Get a valid access token for a provider. Refreshes automatically if expired.
 * Returns null if no token is stored (provider not connected).
 */
export async function getToken(provider: string): Promise<string | null> {
  const db = getDb();
  let row: StoredToken | null;
  try {
    row = db.query("SELECT * FROM oauth_tokens WHERE provider = ?").get(provider) as StoredToken | null;
  } catch {
    // Table might not exist yet
    return null;
  }

  if (!row) return null;

  // Check if token is expired (with 5 minute buffer)
  if (row.expires_at) {
    const expiresAt = new Date(row.expires_at).getTime();
    const bufferMs = 5 * 60 * 1000;
    if (Date.now() >= expiresAt - bufferMs) {
      // Try to refresh
      if (row.refresh_token) {
        // Use mutex to prevent concurrent refresh requests
        let refreshPromise = refreshLocks.get(provider);
        if (!refreshPromise) {
          refreshPromise = refreshToken(provider, row.refresh_token).finally(() => {
            refreshLocks.delete(provider);
          });
          refreshLocks.set(provider, refreshPromise);
        }
        try {
          return await refreshPromise;
        } catch (err: any) {
          logger.warn(`[OAuth] Token refresh failed for ${provider}`, { error: err.message });
          // If refresh token is invalid/revoked, remove stale token to stop retry loops
          if (err.message?.includes("400") || err.message?.includes("401") || err.message?.includes("invalid")) {
            logger.warn(`[OAuth] Removing stale token for ${provider} — user must re-authenticate`);
            try { revokeToken(provider); } catch {}
          }
          return null;
        }
      }
      // No refresh token and token is expired
      return null;
    }
  }

  return row.access_token;
}

/**
 * Refresh an access token using the stored refresh token.
 */
async function refreshToken(provider: string, refreshTokenValue: string): Promise<string> {
  const configs = loadProviderConfigs();
  const cfg = configs[provider];
  if (!cfg) {
    throw new Error(`OAuth provider "${provider}" is not configured.`);
  }

  const body = new URLSearchParams({
    grant_type: "refresh_token",
    refresh_token: refreshTokenValue,
    client_id: cfg.clientId,
    client_secret: cfg.clientSecret,
  });

  const res = await fetch(cfg.tokenUrl, {
    method: "POST",
    headers: {
      "Content-Type": "application/x-www-form-urlencoded",
      Accept: "application/json",
    },
    body,
  });

  if (!res.ok) {
    const errBody = await res.text().catch(() => "");
    logger.error(`[OAuth] Refresh failed for ${provider}`, {
      status: res.status,
      body: errBody.slice(0, 500),
    });
    throw new Error(`Token refresh failed for ${provider} (${res.status}).`);
  }

  const data = await res.json() as Record<string, any>;

  const accessToken = data.access_token;
  if (!accessToken) throw new Error(`No access_token in refresh response for ${provider}.`);

  const expiresIn = data.expires_in ? Number(data.expires_in) : null;
  const expiresAt = expiresIn
    ? new Date(Date.now() + expiresIn * 1000).toISOString()
    : null;

  // Update stored token
  storeToken(provider, {
    access_token: accessToken,
    refresh_token: data.refresh_token ?? refreshTokenValue,
    token_type: data.token_type ?? "Bearer",
    expires_at: expiresAt,
    scope: data.scope ?? null,
  });

  logger.info(`[OAuth] Refreshed token for ${provider}`);
  return accessToken;
}

/**
 * Revoke/delete a stored OAuth token.
 */
export async function revokeToken(provider: string): Promise<boolean> {
  const db = getDb();
  let row: StoredToken | null;
  try {
    row = db.query("SELECT * FROM oauth_tokens WHERE provider = ?").get(provider) as StoredToken | null;
  } catch {
    return false;
  }

  if (!row) return false;

  // Optionally call provider's revoke endpoint
  const configs = loadProviderConfigs();
  const cfg = configs[provider];
  if (cfg?.revokeUrl && row.access_token) {
    try {
      await fetch(cfg.revokeUrl, {
        method: "POST",
        headers: { "Content-Type": "application/x-www-form-urlencoded" },
        body: new URLSearchParams({ token: row.access_token }),
      });
    } catch (err: any) {
      logger.warn(`[OAuth] Revoke endpoint call failed for ${provider}`, { error: err.message });
    }
  }

  // Delete from DB
  db.prepare("DELETE FROM oauth_tokens WHERE provider = ?").run(provider);
  logger.info(`[OAuth] Disconnected ${provider}`);
  return true;
}

/**
 * List all OAuth connections with their status.
 */
export function listConnections(): OAuthConnectionStatus[] {
  const supported = listSupportedProviders();
  const configs = loadProviderConfigs();
  const results: OAuthConnectionStatus[] = [];

  const db = getDb();
  let rows: StoredToken[] = [];
  try {
    rows = db.query("SELECT * FROM oauth_tokens ORDER BY provider").all() as StoredToken[];
  } catch {
    // Table might not exist
  }

  const tokenMap = new Map<string, StoredToken>();
  for (const row of rows) {
    tokenMap.set(row.provider, row);
  }

  for (const provider of supported) {
    const token = tokenMap.get(provider);
    const configured = !!configs[provider];

    if (!token) {
      results.push({
        provider,
        connected: false,
        expires_at: null,
        scope: null,
        token_valid: false,
      });
      continue;
    }

    let tokenValid = true;
    if (token.expires_at) {
      const bufferMs = 5 * 60 * 1000;
      tokenValid = new Date(token.expires_at).getTime() > Date.now() + bufferMs;
    }

    results.push({
      provider,
      connected: true,
      expires_at: token.expires_at,
      scope: token.scope,
      token_valid: tokenValid,
    });
  }

  return results;
}

// ---------------------------------------------------------------------------
// DB helpers
// ---------------------------------------------------------------------------

function storeToken(
  provider: string,
  token: {
    access_token: string;
    refresh_token: string | null;
    token_type: string;
    expires_at: string | null;
    scope: string | null;
  }
): void {
  const db = getDb();
  db.prepare(
    `INSERT INTO oauth_tokens (provider, access_token, refresh_token, token_type, expires_at, scope, updated_at)
     VALUES (?, ?, ?, ?, ?, ?, datetime('now'))
     ON CONFLICT(provider) DO UPDATE SET
       access_token = excluded.access_token,
       refresh_token = CASE WHEN excluded.refresh_token IS NOT NULL THEN excluded.refresh_token ELSE oauth_tokens.refresh_token END,
       token_type = excluded.token_type,
       expires_at = excluded.expires_at,
       scope = excluded.scope,
       updated_at = datetime('now')`
  ).run(
    provider,
    token.access_token,
    token.refresh_token,
    token.token_type,
    token.expires_at,
    token.scope
  );
}

// ---------------------------------------------------------------------------
// Integration helper: get token for integrations (OAuth first, then API key)
// ---------------------------------------------------------------------------

/**
 * Attempt to get an OAuth token for a provider. If no OAuth token exists,
 * returns null so the caller can fall back to its API-key path.
 */
export async function getOAuthTokenForIntegration(provider: string): Promise<string | null> {
  try {
    return await getToken(provider);
  } catch {
    return null;
  }
}
