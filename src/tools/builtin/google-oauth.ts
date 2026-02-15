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
        "IMPORTANT: You need TWO credentials from the user: client_id (looks like 123456-abc.apps.googleusercontent.com) " +
        "and client_secret (starts with GOCSPX-). Ask for BOTH before calling this tool. " +
        "Use action 'start' to begin the OAuth flow. " +
        "Use 'complete' to finish the flow by providing the authorization code the user copied from the browser. " +
        "Use 'status' to check connection state. Use 'disconnect' to remove all stored Google credentials.",
      input_schema: {
        type: "object",
        properties: {
          action: {
            type: "string",
            enum: ["start", "complete", "status", "disconnect"],
            description: "The action to perform.",
          },
          client_id: {
            type: "string",
            description:
              "Google OAuth client ID (looks like 123456789-xxxx.apps.googleusercontent.com). Required for 'start'.",
          },
          client_secret: {
            type: "string",
            description:
              "Google OAuth client secret (starts with GOCSPX-). Required for 'start'.",
          },
          code: {
            type: "string",
            description:
              "The authorization code from the Google OAuth callback URL. Required for 'complete' action.",
          },
        },
        required: ["action"],
      },
    },
    execute: async (input) => {
      const { action, client_id, client_secret, code } = input as {
        action: string;
        client_id?: string;
        client_secret?: string;
        code?: string;
      };

      switch (action) {
        case "start":
          return handleStart(client_id, client_secret);
        case "complete":
          return handleComplete(code);
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
  // If credentials not provided as parameters, check stored secrets
  if (!clientId) clientId = getSecret("google_client_id") ?? undefined;
  if (!clientSecret) clientSecret = getSecret("google_client_secret") ?? undefined;

  if (!clientId || !clientSecret) {
    return JSON.stringify({
      error:
        "Both client_id and client_secret are required. " +
        "Ask the user for BOTH values. " +
        "client_id looks like: 123456789-xxxx.apps.googleusercontent.com. " +
        "client_secret looks like: GOCSPX-xxxxx.",
      setup_guide:
        "The user needs to go to Google Cloud Console > APIs & Services > Credentials > " +
        "Create Credentials > OAuth 2.0 Client ID. Choose 'Desktop app' as the application type. " +
        "Then copy BOTH the Client ID and Client Secret.",
    });
  }

  // Validate client_id format
  if (!clientId.endsWith(".apps.googleusercontent.com")) {
    return JSON.stringify({
      error:
        `The client_id "${clientId.slice(0, 20)}..." does not look valid. ` +
        "A Google OAuth client_id ends with '.apps.googleusercontent.com'. " +
        "Make sure you have the Client ID (not the Client Secret). " +
        "It looks like: 123456789-xxxx.apps.googleusercontent.com",
    });
  }

  // Validate client_secret format
  if (!clientSecret.startsWith("GOCSPX-")) {
    return JSON.stringify({
      error:
        `The client_secret "${clientSecret.slice(0, 10)}..." does not look valid. ` +
        "A Google OAuth client_secret starts with 'GOCSPX-'. " +
        "Make sure you have the Client Secret (not the Client ID).",
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

  let server: ReturnType<typeof Bun.serve>;
  try {
    server = Bun.serve({
      port: 0,
      idleTimeout: 120, // OAuth flow can take a while
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
  } catch (err: any) {
    // If local server fails (e.g. running in a container), fall back to manual flow
    logger.warn("Could not start local OAuth callback server", { error: err.message });
    return handleStartManual();
  }

  const port = server.port;
  const redirectUri = `http://localhost:${port}/oauth/callback`;
  // Store redirect URI so 'complete' action can use it if auto-callback fails
  setSecret("google_redirect_uri", redirectUri, "google");

  let authUrl: string;
  try {
    authUrl = getGoogleAuthUrl(redirectUri);
  } catch (err: any) {
    server.stop();
    return JSON.stringify({ error: err.message });
  }

  // Try to open the authorization URL in the user's default browser
  let browserOpened = false;
  try {
    const cmd =
      process.platform === "darwin"
        ? ["open", authUrl]
        : process.platform === "win32"
          ? ["cmd", "/c", "start", authUrl]
          : ["xdg-open", authUrl];
    Bun.spawn(cmd, { stdio: ["ignore", "ignore", "ignore"] });
    browserOpened = true;
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
        new Error("TIMEOUT")
      );
    }, TIMEOUT_MS);
  });

  try {
    const code = await Promise.race([codePromise, timeoutPromise]);
    clearTimeout(timeoutId!);

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

    // If timed out, it likely means the user is remote (Telegram) and can't use localhost callback.
    // Return the auth URL so they can open it manually and paste back the code.
    if (err.message === "TIMEOUT") {
      logger.info("OAuth auto-callback timed out, providing manual flow URL");
      return JSON.stringify({
        error: "The automatic OAuth callback did not complete in time.",
        manual_flow: true,
        auth_url: authUrl,
        instructions:
          "Send the user this link to open in their browser. After they authorize, " +
          "the browser will redirect to a localhost URL. The URL will contain a 'code' parameter. " +
          "Ask the user to copy the FULL URL from their browser address bar after authorizing, " +
          "then use google_oauth with action 'complete' and pass the code parameter value.",
      });
    }

    logger.error("Google OAuth flow failed", { error: err.message });
    return JSON.stringify({ error: err.message });
  }
}

/**
 * Manual flow: generates an auth URL for the user to open themselves.
 * Used when the local callback server can't be started or user is remote.
 */
function handleStartManual(): string {
  const redirectUri = "http://localhost:8080/oauth/callback";
  setSecret("google_redirect_uri", redirectUri, "google");

  let authUrl: string;
  try {
    authUrl = getGoogleAuthUrl(redirectUri);
  } catch (err: any) {
    return JSON.stringify({ error: err.message });
  }

  return JSON.stringify({
    manual_flow: true,
    auth_url: authUrl,
    instructions:
      "Send this link to the user to open in their browser. After they authorize, " +
      "the browser will redirect to a localhost URL that may show an error page (that's OK). " +
      "Ask the user to copy the FULL URL from their browser address bar. " +
      "Look for the 'code' parameter in the URL (after ?code=). " +
      "Then call google_oauth with action 'complete' and pass that code value.",
  });
}

/**
 * Complete the OAuth flow by exchanging a manually-provided authorization code.
 */
async function handleComplete(code?: string): Promise<string> {
  if (!code) {
    return JSON.stringify({
      error:
        "The 'code' parameter is required. This should be the authorization code " +
        "from the Google OAuth callback URL (the value after ?code= in the redirect URL).",
    });
  }

  // URL-decode the code if it was copied from a URL
  const decodedCode = decodeURIComponent(code);

  // Try to get the redirect URI that was used during 'start'
  const redirectUri = getSecret("google_redirect_uri") || "http://localhost:8080/oauth/callback";

  try {
    await exchangeGoogleCode(decodedCode, redirectUri);

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
    logger.error("Google OAuth code exchange failed", { error: err.message });
    return JSON.stringify({
      error: err.message,
      hint:
        "The authorization code may have expired (they are single-use and expire quickly). " +
        "Try starting the OAuth flow again with google_oauth action 'start'.",
    });
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
