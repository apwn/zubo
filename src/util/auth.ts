import { Database } from "bun:sqlite";

/**
 * API key authentication for the Zubo HTTP API.
 * Keys are stored as SHA-256 hashes — the raw key is only shown at creation time.
 */

export function generateApiKey(): string {
  const bytes = new Uint8Array(32);
  crypto.getRandomValues(bytes);
  return Array.from(bytes)
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

export function hashApiKey(key: string): string {
  const hasher = new Bun.CryptoHasher("sha256");
  hasher.update(key);
  return hasher.digest("hex");
}

export function initAuth(db: Database): void {
  db.run(`
    CREATE TABLE IF NOT EXISTS api_keys (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      label TEXT NOT NULL DEFAULT '',
      key_hash TEXT NOT NULL UNIQUE,
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      last_used_at TEXT
    )
  `);
}

export function createApiKey(
  db: Database,
  label: string
): { key: string; id: number } {
  initAuth(db);
  const key = generateApiKey();
  const keyHash = hashApiKey(key);
  const result = db
    .prepare("INSERT INTO api_keys (label, key_hash) VALUES (?, ?)")
    .run(label, keyHash);
  return { key, id: Number(result.lastInsertRowid) };
}

export function listApiKeys(
  db: Database
): { id: number; label: string; created_at: string; last_used_at: string | null }[] {
  initAuth(db);
  return db
    .query("SELECT id, label, created_at, last_used_at FROM api_keys ORDER BY id")
    .all() as any[];
}

export function deleteApiKey(db: Database, id: number): boolean {
  initAuth(db);
  const result = db.prepare("DELETE FROM api_keys WHERE id = ?").run(id);
  return result.changes > 0;
}

export function validateRequest(db: Database, req: Request): boolean {
  const authHeader = req.headers.get("Authorization");
  if (!authHeader) return false;

  const match = authHeader.match(/^Bearer\s+(.+)$/i);
  if (!match) return false;

  const key = match[1];
  const keyHash = hashApiKey(key);

  initAuth(db);
  const row = db
    .query("SELECT id FROM api_keys WHERE key_hash = ?")
    .get(keyHash) as { id: number } | null;

  if (!row) return false;

  // Update last_used_at
  db.prepare("UPDATE api_keys SET last_used_at = datetime('now') WHERE id = ?").run(
    row.id
  );
  return true;
}

// Session tokens for dashboard embedding (single-use, short-lived)
const sessionTokens = new Map<string, number>(); // token -> expiry timestamp

const MAX_SESSION_TOKENS = 1000;

export function generateSessionToken(): string {
  const token = crypto.randomUUID();
  // 1-hour expiry
  sessionTokens.set(token, Date.now() + 3600_000);

  // Evict oldest tokens if over capacity
  if (sessionTokens.size > MAX_SESSION_TOKENS) {
    const iter = sessionTokens.keys();
    const oldest = iter.next().value;
    if (oldest) sessionTokens.delete(oldest);
  }

  return token;
}

export function validateSessionToken(token: string): boolean {
  const expiry = sessionTokens.get(token);
  if (!expiry) return false;
  // Delete immediately to prevent race condition
  sessionTokens.delete(token);
  if (Date.now() > expiry) return false;
  return true;
}

// Clean expired session tokens periodically
setInterval(() => {
  const now = Date.now();
  for (const [token, expiry] of sessionTokens) {
    if (now > expiry) sessionTokens.delete(token);
  }
}, 300_000).unref?.();
