import { Database } from "bun:sqlite";
import { paths } from "../config/paths";

let _db: Database | null = null;

export function getDb(): Database {
  if (_db) return _db;
  _db = new Database(paths.db, { create: true });
  _db.run("PRAGMA journal_mode = WAL");
  _db.run("PRAGMA foreign_keys = ON");
  _db.run("PRAGMA busy_timeout = 5000");
  return _db;
}

export function closeDb() {
  if (_db) {
    _db.close();
    _db = null;
  }
}
