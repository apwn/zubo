/**
 * Shared Google OAuth 2.0 token management.
 *
 * All Google integration handlers should call `getGoogleAccessToken()`
 * instead of reading secrets directly. This module handles token refresh
 * and the initial authorization code exchange.
 */

import { getSecret, setSecret } from "../secrets/store";

const GOOGLE_TOKEN_URL = "https://oauth2.googleapis.com/token";
const GOOGLE_AUTH_URL = "https://accounts.google.com/o/oauth2/v2/auth";

/** Scopes requested for all Google integrations */
const SCOPES = [
  "https://www.googleapis.com/auth/gmail.modify",
  "https://www.googleapis.com/auth/calendar",
  "https://www.googleapis.com/auth/spreadsheets",
  "https://www.googleapis.com/auth/documents",
  "https://www.googleapis.com/auth/drive",
];

/**
 * Returns a valid Google access token, refreshing if necessary.
 *
 * This is the single entry point every Google handler should use.
 * Throws if no refresh token is stored (user has not connected Google yet).
 */
export async function getGoogleAccessToken(): Promise<string> {
  const accessToken = getSecret("google_access_token");
  const expiresAtRaw = getSecret("google_token_expires_at");

  if (accessToken && expiresAtRaw) {
    const expiresAt = parseInt(expiresAtRaw, 10);
    // Refresh 5 minutes before actual expiry to avoid race conditions
    const bufferMs = 5 * 60 * 1000;
    if (Date.now() < expiresAt - bufferMs) {
      return accessToken;
    }
  }

  // Token missing or expired -- attempt refresh
  return refreshGoogleToken();
}

/**
 * Refreshes the Google access token using the stored refresh token.
 * Stores the new access token and its expiry time.
 */
export async function refreshGoogleToken(): Promise<string> {
  const refreshToken = getSecret("google_refresh_token");
  if (!refreshToken) {
    throw new Error(
      "Google not connected. Use the google_oauth tool to set up Google."
    );
  }

  const clientId = getSecret("google_client_id");
  const clientSecret = getSecret("google_client_secret");

  if (!clientId || !clientSecret) {
    throw new Error(
      "Google client credentials missing. Use the google_oauth tool to set up Google."
    );
  }

  const res = await fetch(GOOGLE_TOKEN_URL, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      grant_type: "refresh_token",
      refresh_token: refreshToken,
      client_id: clientId,
      client_secret: clientSecret,
    }),
  });

  if (!res.ok) {
    const body = await res.text().catch(() => "");
    console.error(`[Google] Token refresh failed ${res.status}: ${body.slice(0, 500)}`);
    throw new Error(
      `Google token refresh failed (${res.status}). You may need to reconnect Google using the google_oauth tool.`
    );
  }

  const data = (await res.json()) as {
    access_token: string;
    expires_in: number;
    token_type: string;
    refresh_token?: string;
  };

  // Store new access token and computed expiry timestamp
  setSecret("google_access_token", data.access_token, "google");
  const expiresAt = Date.now() + data.expires_in * 1000;
  setSecret("google_token_expires_at", String(expiresAt), "google");

  // Google occasionally rotates refresh tokens -- store the new one if provided
  if (data.refresh_token) {
    setSecret("google_refresh_token", data.refresh_token, "google");
  }

  return data.access_token;
}

/**
 * Exchanges an authorization code for access + refresh tokens.
 * Called once after the user completes the OAuth consent screen.
 */
export async function exchangeGoogleCode(
  code: string,
  redirectUri: string
): Promise<void> {
  const clientId = getSecret("google_client_id");
  const clientSecret = getSecret("google_client_secret");

  if (!clientId || !clientSecret) {
    throw new Error(
      "Google client credentials not found. Store google_client_id and google_client_secret first."
    );
  }

  const res = await fetch(GOOGLE_TOKEN_URL, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      grant_type: "authorization_code",
      code,
      redirect_uri: redirectUri,
      client_id: clientId,
      client_secret: clientSecret,
    }),
  });

  if (!res.ok) {
    const body = await res.text().catch(() => "");
    console.error(`[Google] Code exchange failed ${res.status}: ${body.slice(0, 500)}`);
    throw new Error(
      `Google authorization failed (${res.status}). Please try the OAuth flow again.`
    );
  }

  const data = (await res.json()) as {
    access_token: string;
    expires_in: number;
    refresh_token?: string;
    token_type: string;
  };

  setSecret("google_access_token", data.access_token, "google");
  const expiresAt = Date.now() + data.expires_in * 1000;
  setSecret("google_token_expires_at", String(expiresAt), "google");

  if (data.refresh_token) {
    setSecret("google_refresh_token", data.refresh_token, "google");
  }
}

/**
 * Builds the Google OAuth 2.0 authorization URL.
 * Uses `access_type=offline` and `prompt=consent` to ensure a refresh token
 * is always returned, even if the user has previously authorized the app.
 */
export function getGoogleAuthUrl(redirectUri: string): string {
  const clientId = getSecret("google_client_id");
  if (!clientId) {
    throw new Error("google_client_id not found in secrets.");
  }

  const params = new URLSearchParams({
    client_id: clientId,
    redirect_uri: redirectUri,
    response_type: "code",
    scope: SCOPES.join(" "),
    access_type: "offline",
    prompt: "consent",
  });

  return `${GOOGLE_AUTH_URL}?${params.toString()}`;
}
