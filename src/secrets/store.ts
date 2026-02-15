import { getDb } from "../db/connection";

export interface SecretInfo {
  name: string;
  service: string | null;
  updated_at: string;
}

export function setSecret(name: string, value: string, service?: string): void {
  const db = getDb();
  db.prepare(
    `INSERT INTO secrets (name, value, service, updated_at)
     VALUES (?, ?, ?, datetime('now'))
     ON CONFLICT(name) DO UPDATE SET value = excluded.value, service = excluded.service, updated_at = datetime('now')`
  ).run(name, value, service ?? null);
}

export function getSecret(name: string): string | null {
  const db = getDb();
  const row = db.query("SELECT value FROM secrets WHERE name = ?").get(name) as
    | { value: string }
    | null;
  return row?.value ?? null;
}

export function listSecrets(service?: string): SecretInfo[] {
  const db = getDb();
  if (service) {
    return db
      .query("SELECT name, service, updated_at FROM secrets WHERE service = ? ORDER BY name")
      .all(service) as SecretInfo[];
  }
  return db
    .query("SELECT name, service, updated_at FROM secrets ORDER BY name")
    .all() as SecretInfo[];
}

export function deleteSecret(name: string): boolean {
  const db = getDb();
  const result = db.prepare("DELETE FROM secrets WHERE name = ?").run(name);
  return result.changes > 0;
}

/**
 * Exposes ONLY OAuth helpers on globalThis.Zubo for built-in skill handlers.
 * getSecret is intentionally NOT exposed globally — user-installed skills
 * receive secrets through scoped environment variables in the sandbox instead.
 * This prevents malicious skills from accessing secrets they don't need.
 */
export function exposeOAuthRuntime(
  getGoogleAccessToken: () => Promise<string>,
  getOAuthToken: (provider: string) => Promise<string | null>
): void {
  const g = globalThis as any;
  if (!g.Zubo) g.Zubo = {};
  g.Zubo.getGoogleToken = getGoogleAccessToken;
  g.Zubo.getOAuthToken = getOAuthToken;
}
