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
 * Exposes getSecret (and helpers) on globalThis.Zubo so user-created
 * skill handlers can access secrets without relative imports.
 */
export function exposeSecretsRuntime(): void {
  const g = globalThis as any;
  if (!g.Zubo) g.Zubo = {};
  g.Zubo.getSecret = getSecret;
}

/**
 * Exposes getGoogleToken on globalThis.Zubo so installed Google skill
 * handlers can get a valid OAuth access token without importing from src.
 */
export function exposeGoogleTokenRuntime(
  getGoogleAccessToken: () => Promise<string>
): void {
  const g = globalThis as any;
  if (!g.Zubo) g.Zubo = {};
  g.Zubo.getGoogleToken = getGoogleAccessToken;
}

/**
 * Exposes getOAuthToken on globalThis.Zubo so skill handlers can get
 * a valid OAuth access token for any configured provider.
 */
export function exposeOAuthTokenRuntime(
  getOAuthToken: (provider: string) => Promise<string | null>
): void {
  const g = globalThis as any;
  if (!g.Zubo) g.Zubo = {};
  g.Zubo.getOAuthToken = getOAuthToken;
}
