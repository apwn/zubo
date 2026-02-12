/**
 * Shared helpers for integration handlers.
 * Prevents leaking secrets/tokens via API error responses or exception messages.
 */

/**
 * Safely handle an API response error. Logs the full error but returns
 * only the status code to the conversation — never the response body,
 * which may echo tokens or internal details.
 */
export async function safeApiError(res: Response, service: string): Promise<string> {
  // Read body once so it doesn't hang
  const body = await res.text().catch(() => "");
  // Log full details for debugging (goes to zubo.log, not conversation)
  console.error(`[${service}] API error ${res.status}: ${body.slice(0, 500)}`);
  return JSON.stringify({ error: `${service} API error: ${res.status} ${res.statusText}` });
}

/**
 * Safely handle an exception. Never expose raw error messages which
 * may contain tokens, URLs with credentials, or internal details.
 */
export function safeExceptionError(err: any, service: string): string {
  console.error(`[${service}] Request failed: ${err.message}`);
  return JSON.stringify({ error: `${service} request failed. Check logs for details.` });
}
