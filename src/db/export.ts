import { Database } from "bun:sqlite";
import { existsSync, mkdirSync, readFileSync, writeFileSync, statSync } from "fs";
import { join, dirname } from "path";

/**
 * Database export/import/backup utilities.
 */

interface ExportData {
  version: 1;
  exportedAt: string;
  tables: Record<string, any[]>;
}

// Tables to include in export (skip FTS virtual tables and internal sqlite tables)
// Tables to include in export — secrets and api_keys are excluded by default
// to prevent accidental credential exposure
const EXPORT_TABLES = [
  "sessions",
  "messages",
  "memory_chunks",
  "cron_jobs",
  "cron_logs",
  "usage",
  "agents",
  "workflows",
  "workflow_executions",
  "proactive_triggers",
  "uploads",
  "tool_metrics",
  "perf_snapshots",
];

export function exportDatabase(db: Database, outputPath: string): void {
  const data: ExportData = {
    version: 1,
    exportedAt: new Date().toISOString(),
    tables: {},
  };

  for (const table of EXPORT_TABLES) {
    try {
      const rows = db.query(`SELECT * FROM ${table}`).all();
      if (rows.length > 0) {
        data.tables[table] = rows;
      }
    } catch {
      // Table may not exist yet — skip
    }
  }

  mkdirSync(dirname(outputPath), { recursive: true });
  writeFileSync(outputPath, JSON.stringify(data, null, 2));
}

export function importDatabase(db: Database, inputPath: string): { imported: number; skipped: number } {
  const raw = readFileSync(inputPath, "utf-8");
  const data = JSON.parse(raw) as ExportData;

  if (data.version !== 1) {
    throw new Error(`Unsupported export version: ${data.version}`);
  }

  let imported = 0;
  let skipped = 0;

  for (const [table, rows] of Object.entries(data.tables)) {
    if (!EXPORT_TABLES.includes(table)) continue;

    // Verify table exists
    const tableCheck = db
      .query("SELECT name FROM sqlite_master WHERE type='table' AND name=?")
      .get(table) as any;
    if (!tableCheck) continue;

    // Validate column names against actual table schema to prevent SQL injection
    const tableInfo = db.query(`PRAGMA table_info(${table})`).all() as { name: string }[];
    const validColumns = new Set(tableInfo.map((c) => c.name));

    for (const row of rows) {
      const columns = Object.keys(row).filter((c) => validColumns.has(c));
      if (columns.length === 0) { skipped++; continue; }
      const placeholders = columns.map(() => "?").join(", ");
      const values = columns.map((c) => row[c]);
      try {
        db.prepare(
          `INSERT OR IGNORE INTO ${table} (${columns.join(", ")}) VALUES (${placeholders})`
        ).run(...values);
        imported++;
      } catch {
        skipped++;
      }
    }
  }

  return { imported, skipped };
}

export function backupDatabase(dbPath: string, backupDir: string): string {
  mkdirSync(backupDir, { recursive: true });
  const timestamp = new Date().toISOString().replace(/[:.]/g, "-");
  const backupPath = join(backupDir, `zubo-backup-${timestamp}.db`);

  // Validate backup path doesn't escape the target directory
  const resolvedBackup = require("path").resolve(backupPath);
  const resolvedDir = require("path").resolve(backupDir);
  if (!resolvedBackup.startsWith(resolvedDir + "/") && resolvedBackup !== resolvedDir) {
    throw new Error("Invalid backup path");
  }

  // Use SQLite VACUUM INTO for atomic backup — path is validated above
  const db = new Database(dbPath, { readonly: true });
  try {
    db.run(`VACUUM INTO '${backupPath.replace(/'/g, "''")}'`);
  } finally {
    db.close();
  }

  return backupPath;
}

export function getDbStats(db: Database): { tables: Record<string, number>; sizeBytes?: number } {
  const stats: Record<string, number> = {};

  for (const table of EXPORT_TABLES) {
    try {
      const row = db.query(`SELECT COUNT(*) as c FROM ${table}`).get() as any;
      stats[table] = row?.c ?? 0;
    } catch {
      // Table doesn't exist
    }
  }

  return { tables: stats };
}

export function getDbSizeBytes(dbPath: string): number {
  try {
    return statSync(dbPath).size;
  } catch {
    return 0;
  }
}
