/**
 * Mask a token/secret for safe display in API responses.
 * Shows first 6 + last 4 chars with "..." in middle.
 * Short tokens (<=12 chars) are fully masked.
 */
export function maskToken(token: string): string {
  if (!token) return "";
  if (token.length <= 12) return "\u2022".repeat(token.length);
  return token.slice(0, 6) + "..." + token.slice(-4);
}
