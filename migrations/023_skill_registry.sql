-- Skill Registry: Community skill marketplace tables

CREATE TABLE IF NOT EXISTS registry_profiles (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  github_id INTEGER UNIQUE NOT NULL,
  username TEXT UNIQUE NOT NULL,
  display_name TEXT,
  bio TEXT,
  website TEXT,
  github_url TEXT,
  avatar_url TEXT,
  email TEXT,
  session_token TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS registry_skills (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT UNIQUE NOT NULL,
  description TEXT NOT NULL,
  author_id INTEGER NOT NULL REFERENCES registry_profiles(id),
  version TEXT NOT NULL DEFAULT '1.0.0',
  tags TEXT NOT NULL DEFAULT '[]',
  secrets TEXT NOT NULL DEFAULT '[]',
  handler_code TEXT NOT NULL,
  skill_md TEXT,
  repo_url TEXT,
  status TEXT NOT NULL DEFAULT 'approved' CHECK(status IN ('approved', 'flagged', 'rejected')),
  review_notes TEXT NOT NULL DEFAULT '[]',
  risk_level TEXT NOT NULL DEFAULT 'low' CHECK(risk_level IN ('low', 'medium', 'high')),
  stars_count INTEGER NOT NULL DEFAULT 0,
  install_count INTEGER NOT NULL DEFAULT 0,
  report_count INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE VIRTUAL TABLE IF NOT EXISTS registry_skills_fts USING fts5(
  name,
  description,
  tags,
  content='registry_skills',
  content_rowid='id'
);

-- Triggers to keep FTS in sync
CREATE TRIGGER IF NOT EXISTS registry_skills_ai AFTER INSERT ON registry_skills BEGIN
  INSERT INTO registry_skills_fts(rowid, name, description, tags)
  VALUES (new.id, new.name, new.description, new.tags);
END;

CREATE TRIGGER IF NOT EXISTS registry_skills_ad AFTER DELETE ON registry_skills BEGIN
  INSERT INTO registry_skills_fts(registry_skills_fts, rowid, name, description, tags)
  VALUES ('delete', old.id, old.name, old.description, old.tags);
END;

CREATE TRIGGER IF NOT EXISTS registry_skills_au AFTER UPDATE ON registry_skills BEGIN
  INSERT INTO registry_skills_fts(registry_skills_fts, rowid, name, description, tags)
  VALUES ('delete', old.id, old.name, old.description, old.tags);
  INSERT INTO registry_skills_fts(rowid, name, description, tags)
  VALUES (new.id, new.name, new.description, new.tags);
END;

CREATE TABLE IF NOT EXISTS registry_stars (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  skill_id INTEGER NOT NULL REFERENCES registry_skills(id) ON DELETE CASCADE,
  profile_id INTEGER NOT NULL REFERENCES registry_profiles(id) ON DELETE CASCADE,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  UNIQUE(skill_id, profile_id)
);

CREATE TABLE IF NOT EXISTS registry_installs (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  skill_id INTEGER NOT NULL REFERENCES registry_skills(id) ON DELETE CASCADE,
  user_fingerprint TEXT,
  installed_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS registry_reports (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  skill_id INTEGER NOT NULL REFERENCES registry_skills(id) ON DELETE CASCADE,
  reporter_email TEXT NOT NULL,
  reason TEXT NOT NULL,
  details TEXT,
  status TEXT NOT NULL DEFAULT 'open' CHECK(status IN ('open', 'resolved', 'dismissed')),
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_registry_skills_status ON registry_skills(status);
CREATE INDEX IF NOT EXISTS idx_registry_skills_author ON registry_skills(author_id);
CREATE INDEX IF NOT EXISTS idx_registry_installs_skill ON registry_installs(skill_id);
CREATE INDEX IF NOT EXISTS idx_registry_installs_date ON registry_installs(installed_at);
CREATE INDEX IF NOT EXISTS idx_registry_reports_status ON registry_reports(status);
CREATE INDEX IF NOT EXISTS idx_registry_stars_skill ON registry_stars(skill_id);
