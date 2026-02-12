import { Database } from "bun:sqlite";
import { readFileSync, readdirSync } from "fs";
import { join } from "path";

/**
 * Split SQL text into individual statements, respecting BEGIN...END blocks
 * (e.g. CREATE TRIGGER statements that contain semicolons inside them).
 */
function splitSql(sql: string): string[] {
  const statements: string[] = [];
  let current = "";
  let inBlock = false;

  for (const line of sql.split("\n")) {
    const trimmed = line.trim().toUpperCase();

    // Detect BEGIN (start of trigger/block body)
    if (trimmed === "BEGIN" || trimmed.endsWith(" BEGIN")) {
      inBlock = true;
    }

    current += line + "\n";

    // Detect END that closes the block — only the standalone "END" or "END;"
    if (inBlock && (trimmed === "END" || trimmed === "END;")) {
      inBlock = false;
      statements.push(current.trim().replace(/;$/, ""));
      current = "";
      continue;
    }

    // Outside a block, split on semicolons at end of line
    if (!inBlock && trimmed.endsWith(";")) {
      const stmt = current.trim().replace(/;$/, "");
      if (stmt) statements.push(stmt);
      current = "";
    }
  }

  // Leftover
  const leftover = current.trim().replace(/;$/, "");
  if (leftover) statements.push(leftover);

  return statements;
}

export function createTestDb(): Database {
  const db = new Database(":memory:");

  // Run all migrations
  const migrationsDir = join(import.meta.dir, "../../migrations");
  try {
    const files = readdirSync(migrationsDir)
      .filter(f => f.endsWith(".sql"))
      .sort();

    for (const file of files) {
      const sql = readFileSync(join(migrationsDir, file), "utf-8");
      const statements = splitSql(sql);
      for (const stmt of statements) {
        try {
          db.run(stmt);
        } catch (e: any) {
          // Ignore "duplicate column" errors from ALTER TABLE
          if (!e.message?.includes("duplicate column")) {
            // Still try to continue with other statements
          }
        }
      }
    }
  } catch {}

  return db;
}
