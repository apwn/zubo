import { registerTool } from "../registry";
import { setSecret, getSecret, deleteSecret } from "../../secrets/store";
import {
  getGoogleAuthUrl,
  exchangeGoogleCode,
} from "../../util/google-tokens";
import { logger } from "../../util/logger";

/**
 * Registers the `google_oauth` tool that lets the agent (and user) start,
 * check, and tear down the Google OAuth 2.0 connection.
 */
export function registerGoogleOAuthTool(): void {
  registerTool({
    definition: {
      name: "google_oauth",
      description:
        "Manage the Google OAuth 2.0 connection used by Gmail, Calendar, Sheets, Docs, and Drive. " +
        "Use action 'start' to begin the OAuth flow (requires client_id and client_secret from Google Cloud Console). " +
        "Use 'status' to check connection state. Use 'disconnect' to remove all stored Google credentials.",
      input_schema: {
        type: "object",
        properties: {
          action: {
            type: "string",
            enum: ["start", "status", "disconnect"],
            description: "The action to perform.",
          },
          client_id: {
            type: "string",
            description:
              "Google OAuth client ID (required for 'start' action).",
          },
          client_secret: {
            type: "string",
            description:
              "Google OAuth client secret (required for 'start' action).",
          },
        },
        required: ["action"],
      },
    },
    execute: async (input) => {
      const { action, client_id, client_secret } = input as {
        action: string;
        client_id?: string;
        client_secret?: string;
      };

      switch (action) {
        case "start":
          return handleStart(client_id, client_secret);
        case "status":
          return handleStatus();
        case "disconnect":
          return handleDisconnect();
        default:
          return JSON.stringify({ error: `Unknown action: ${action}` });
      }
    },
  });
}

// ---------------------------------------------------------------------------
// Action handlers
// ---------------------------------------------------------------------------

async function handleStart(
  clientId?: string,
  clientSecret?: string
): Promise<string> {
  if (!clientId || !clientSecret) {
    return JSON.stringify({
      error:
        "Both client_id and client_secret are required for the 'start' action. " +
        "Get these from the Google Cloud Console (APIs & Services > Credentials > OAuth 2.0 Client ID).",
    });
  }

  // Persist client credentials
  setSecret("google_client_id", clientId, "google");
  setSecret("google_client_secret", clientSecret, "google");

  // Start a temporary local HTTP server to receive the OAuth callback
  let resolveCallback: (code: string) => void;
  let rejectCallback: (reason: Error) => void;

  const codePromise = new Promise<string>((resolve, reject) => {
    resolveCallback = resolve;
    rejectCallback = reject;
  });

  const server = Bun.serve({
    port: 0, // random available port
    fetch(req) {
      const url = new URL(req.url);
      if (url.pathname === "/oauth/callback") {
        const code = url.searchParams.get("code");
        const error = url.searchParams.get("error");

        if (error) {
          rejectCallback(new Error(`Google OAuth error: ${error}`));
          return new Response(
            "<html><body><h2>Authorization failed</h2><p>You can close this window.</p></body></html>",
            { headers: { "Content-Type": "text/html" } }
          );
        }

        if (code) {
          resolveCallback(code);
          return new Response(
            "<html><body><h2>Google connected successfully!</h2><p>You can close this window and return to Zubo.</p></body></html>",
            { headers: { "Content-Type": "text/html" } }
          );
        }

        return new Response("Missing authorization code.", { status: 400 });
      }

      return new Response("Not found", { status: 404 });
    },
  });

  const port = server.port;
  const redirectUri = `http://localhost:${port}/oauth/callback`;

  let authUrl: string;
  try {
    authUrl = getGoogleAuthUrl(redirectUri);
  } catch (err: any) {
    server.stop();
    return JSON.stringify({ error: err.message });
  }

  // Open the authorization URL in the user's default browser
  try {
    const cmd =
      process.platform === "darwin"
        ? ["open", authUrl]
        : process.platform === "win32"
          ? ["cmd", "/c", "start", authUrl]
          : ["xdg-open", authUrl];
    Bun.spawn(cmd, { stdio: ["ignore", "ignore", "ignore"] });
  } catch (err: any) {
    logger.warn("Failed to open browser for Google OAuth", {
      error: err.message,
    });
  }

  // Wait for the callback with a 120-second timeout
  const TIMEOUT_MS = 120_000;
  let timeoutId: ReturnType<typeof setTimeout>;
  const timeoutPromise = new Promise<never>((_resolve, reject) => {
    timeoutId = setTimeout(() => {
      reject(
        new Error(
          "OAuth callback timed out after 120 seconds. Please try again."
        )
      );
    }, TIMEOUT_MS);
  });

  try {
    const code = await Promise.race([codePromise, timeoutPromise]);
    clearTimeout(timeoutId!);

    // Exchange the authorization code for tokens
    await exchangeGoogleCode(code, redirectUri);

    server.stop();

    return JSON.stringify({
      success: true,
      message:
        "Google connected successfully! The following services are now available: Gmail, Google Calendar, Google Sheets, Google Docs, Google Drive.",
      services: [
        "gmail",
        "google_calendar",
        "google_sheets",
        "google_docs",
        "google_drive",
      ],
    });
  } catch (err: any) {
    clearTimeout(timeoutId!);
    server.stop();
    logger.error("Google OAuth flow failed", { error: err.message });
    return JSON.stringify({ error: err.message });
  }
}

function handleStatus(): string {
  const refreshToken = getSecret("google_refresh_token");
  const accessToken = getSecret("google_access_token");
  const expiresAtRaw = getSecret("google_token_expires_at");
  const clientId = getSecret("google_client_id");

  if (!refreshToken) {
    return JSON.stringify({
      connected: false,
      message:
        "Google is not connected. Use google_oauth with action 'start' to set up the connection.",
    });
  }

  const expiresAt = expiresAtRaw ? parseInt(expiresAtRaw, 10) : 0;
  const tokenValid = accessToken && Date.now() < expiresAt;

  return JSON.stringify({
    connected: true,
    has_client_id: !!clientId,
    has_refresh_token: true,
    access_token_valid: !!tokenValid,
    access_token_expires: expiresAt
      ? new Date(expiresAt).toISOString()
      : null,
    services: [
      "gmail",
      "google_calendar",
      "google_sheets",
      "google_docs",
      "google_drive",
    ],
  });
}

function handleDisconnect(): string {
  const secretNames = [
    "google_client_id",
    "google_client_secret",
    "google_access_token",
    "google_refresh_token",
    "google_token_expires_at",
  ];

  let removed = 0;
  for (const name of secretNames) {
    if (deleteSecret(name)) removed++;
  }

  return JSON.stringify({
    success: true,
    message: `Google disconnected. Removed ${removed} stored credential(s). Google services (Gmail, Calendar, Sheets, Docs, Drive) will no longer work until reconnected.`,
  });
}
