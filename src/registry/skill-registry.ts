import { Database } from "bun:sqlite";

// ─── Types ───────────────────────────────────────────────────────────

export interface Profile {
  id: number;
  github_id: number;
  username: string;
  display_name: string | null;
  bio: string | null;
  website: string | null;
  github_url: string | null;
  avatar_url: string | null;
  email: string | null;
  session_token: string | null;
  created_at: string;
  updated_at: string;
}

export interface Skill {
  id: number;
  name: string;
  description: string;
  author_id: number;
  version: string;
  tags: string;
  secrets: string;
  handler_code: string;
  skill_md: string | null;
  repo_url: string | null;
  status: "approved" | "flagged" | "rejected";
  review_notes: string;
  risk_level: "low" | "medium" | "high";
  stars_count: number;
  install_count: number;
  report_count: number;
  created_at: string;
  updated_at: string;
}

export interface SkillWithAuthor extends Skill {
  author_username: string;
  author_avatar_url: string | null;
}

export interface ReviewFinding {
  severity: "high" | "medium";
  pattern: string;
  description: string;
  line: number;
}

export interface ReviewResult {
  risk_level: "low" | "medium" | "high";
  status: "approved" | "flagged" | "rejected";
  findings: ReviewFinding[];
}

export interface AuthorStats {
  skills_count: number;
  total_stars: number;
  total_installs: number;
}

export interface SubmitSkillInput {
  name: string;
  description: string;
  version?: string;
  tags?: string[];
  secrets?: string[];
  handler_code: string;
  skill_md?: string;
  repo_url?: string;
}

// ─── Auto-Review Scanner ─────────────────────────────────────────────

const HIGH_RISK_PATTERNS: Array<{ regex: RegExp; description: string }> = [
  // Dynamic code execution - detect eval/Function calls in submitted code
  { regex: /\beval\s*\(/, description: "Dynamic code execution detected" },
  { regex: /new\s+Function\s*\(/, description: "Dynamic code execution via Function constructor" },
  { regex: /\batob\s*\(/, description: "Base64 decoding (atob)" },
  { regex: /Buffer\.from\s*\([^)]*,\s*['"]base64['"]/, description: "Base64 decoding via Buffer" },
  { regex: /[0-9a-fA-F]{40,}/, description: "Long hex string detected" },
  { regex: /pastebin\.com|bit\.ly|ngrok\.io|requestbin|pipedream/, description: "Suspicious external domain" },
  { regex: /process\.env\.(HOME|SSH|AWS_SECRET|AWS_ACCESS|GITHUB_TOKEN)/, description: "Accessing sensitive environment variables" },
];

const MEDIUM_RISK_PATTERNS: Array<{ regex: RegExp; description: string }> = [
  { regex: /\bfetch\s*\(/, description: "Network request via fetch()" },
  { regex: /require\s*\(\s*['"](?:http|https|net|dgram)['"]/, description: "Network module import" },
  { regex: /import\s+.*from\s+['"](?:http|https|net|dgram)['"]/, description: "Network module import" },
  { regex: /Bun\.spawn|child_process|execSync|spawnSync/, description: "Process spawning" },
  { regex: /(?:fs|Bun)\.(?:write|unlink|rm|rmdir)/, description: "Filesystem write/delete operation" },
  { regex: /process\.env/, description: "Environment variable access" },
  { regex: /Bun\.write/, description: "Bun file write" },
  { regex: /new\s+WebSocket\s*\(/, description: "WebSocket connection" },
  { regex: /import\s*\(/, description: "Dynamic import" },
];

export function scanHandlerCode(code: string): ReviewResult {
  const findings: ReviewFinding[] = [];
  const lines = code.split("\n");

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const lineNum = i + 1;

    for (const pattern of HIGH_RISK_PATTERNS) {
      if (pattern.regex.test(line)) {
        findings.push({
          severity: "high",
          pattern: pattern.regex.source,
          description: pattern.description,
          line: lineNum,
        });
      }
    }

    for (const pattern of MEDIUM_RISK_PATTERNS) {
      if (pattern.regex.test(line)) {
        findings.push({
          severity: "medium",
          pattern: pattern.regex.source,
          description: pattern.description,
          line: lineNum,
        });
      }
    }
  }

  const hasHigh = findings.some((f) => f.severity === "high");
  const hasMedium = findings.some((f) => f.severity === "medium");

  if (hasHigh) {
    return { risk_level: "high", status: "rejected", findings };
  }
  if (hasMedium) {
    return { risk_level: "medium", status: "flagged", findings };
  }
  return { risk_level: "low", status: "approved", findings: [] };
}

// ─── Profile & Auth ──────────────────────────────────────────────────

export interface GitHubUser {
  id: number;
  login: string;
  name?: string | null;
  bio?: string | null;
  blog?: string | null;
  html_url?: string;
  avatar_url?: string;
  email?: string | null;
}

export function createOrUpdateProfile(db: Database, githubUser: GitHubUser): Profile {
  const existing = db.query<Profile, [number]>(
    "SELECT * FROM registry_profiles WHERE github_id = ?"
  ).get(githubUser.id);

  if (existing) {
    db.prepare(
      `UPDATE registry_profiles SET
        username = ?, display_name = ?, bio = ?, website = ?,
        github_url = ?, avatar_url = ?, email = ?, updated_at = datetime('now')
      WHERE github_id = ?`
    ).run(
      githubUser.login,
      githubUser.name ?? existing.display_name,
      githubUser.bio ?? existing.bio,
      githubUser.blog ?? existing.website,
      githubUser.html_url ?? existing.github_url,
      githubUser.avatar_url ?? existing.avatar_url,
      githubUser.email ?? existing.email,
      githubUser.id
    );
    return db.query<Profile, [number]>(
      "SELECT * FROM registry_profiles WHERE github_id = ?"
    ).get(githubUser.id)!;
  }

  db.prepare(
    `INSERT INTO registry_profiles (github_id, username, display_name, bio, website, github_url, avatar_url, email)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?)`
  ).run(
    githubUser.id,
    githubUser.login,
    githubUser.name ?? null,
    githubUser.bio ?? null,
    githubUser.blog ?? null,
    githubUser.html_url ?? null,
    githubUser.avatar_url ?? null,
    githubUser.email ?? null
  );

  return db.query<Profile, [number]>(
    "SELECT * FROM registry_profiles WHERE github_id = ?"
  ).get(githubUser.id)!;
}

export function createSessionToken(db: Database, profileId: number): string {
  const token = crypto.randomUUID() + "-" + crypto.randomUUID();
  db.prepare("UPDATE registry_profiles SET session_token = ? WHERE id = ?").run(token, profileId);
  return token;
}

export function getProfileByToken(db: Database, token: string): Profile | null {
  if (!token) return null;
  return db.query<Profile, [string]>(
    "SELECT * FROM registry_profiles WHERE session_token = ?"
  ).get(token) ?? null;
}

export function getProfile(db: Database, username: string): Profile | null {
  return db.query<Profile, [string]>(
    "SELECT * FROM registry_profiles WHERE username = ?"
  ).get(username) ?? null;
}

export function getProfileById(db: Database, id: number): Profile | null {
  return db.query<Profile, [number]>(
    "SELECT * FROM registry_profiles WHERE id = ?"
  ).get(id) ?? null;
}

export function updateProfile(
  db: Database,
  profileId: number,
  fields: Partial<Pick<Profile, "display_name" | "bio" | "website">>
): void {
  const sets: string[] = [];
  const values: any[] = [];
  if (fields.display_name !== undefined) { sets.push("display_name = ?"); values.push(fields.display_name); }
  if (fields.bio !== undefined) { sets.push("bio = ?"); values.push(fields.bio); }
  if (fields.website !== undefined) { sets.push("website = ?"); values.push(fields.website); }
  if (sets.length === 0) return;
  sets.push("updated_at = datetime('now')");
  values.push(profileId);
  db.prepare(`UPDATE registry_profiles SET ${sets.join(", ")} WHERE id = ?`).run(...values);
}

export function clearSessionToken(db: Database, profileId: number): void {
  db.prepare("UPDATE registry_profiles SET session_token = NULL WHERE id = ?").run(profileId);
}

export function getAuthorStats(db: Database, profileId: number): AuthorStats {
  const row = db.query<{ skills_count: number; total_stars: number; total_installs: number }, [number]>(
    `SELECT
      COUNT(*) as skills_count,
      COALESCE(SUM(stars_count), 0) as total_stars,
      COALESCE(SUM(install_count), 0) as total_installs
    FROM registry_skills WHERE author_id = ?`
  ).get(profileId);
  return row ?? { skills_count: 0, total_stars: 0, total_installs: 0 };
}

// ─── Skill CRUD ──────────────────────────────────────────────────────

export function submitSkill(db: Database, input: SubmitSkillInput, authorId: number): { skill: Skill; review: ReviewResult } {
  if (!input.name || !/^[a-z0-9_-]+$/.test(input.name)) {
    throw new Error("Invalid skill name — only lowercase letters, numbers, hyphens, and underscores allowed");
  }
  if (input.name.length > 64) {
    throw new Error("Skill name must be 64 characters or fewer");
  }
  if (!input.description || input.description.length < 10) {
    throw new Error("Description must be at least 10 characters");
  }
  if (!input.handler_code || input.handler_code.length > 100_000) {
    throw new Error("Handler code must be between 1 and 100,000 characters");
  }

  const existing = db.query<{ id: number }, [string]>(
    "SELECT id FROM registry_skills WHERE name = ?"
  ).get(input.name);
  if (existing) {
    throw new Error(`Skill "${input.name}" already exists`);
  }

  const review = scanHandlerCode(input.handler_code);

  const tagsJson = JSON.stringify(input.tags ?? []);
  const secretsJson = JSON.stringify(input.secrets ?? []);
  const reviewNotesJson = JSON.stringify(review.findings);

  db.prepare(
    `INSERT INTO registry_skills
      (name, description, author_id, version, tags, secrets, handler_code, skill_md, repo_url, status, review_notes, risk_level)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
  ).run(
    input.name,
    input.description,
    authorId,
    input.version ?? "1.0.0",
    tagsJson,
    secretsJson,
    input.handler_code,
    input.skill_md ?? null,
    input.repo_url ?? null,
    review.status,
    reviewNotesJson,
    review.risk_level
  );

  const skill = db.query<Skill, [string]>(
    "SELECT * FROM registry_skills WHERE name = ?"
  ).get(input.name)!;

  return { skill, review };
}

export function getSkillById(db: Database, id: number): Skill | null {
  return db.query<Skill, [number]>(
    "SELECT * FROM registry_skills WHERE id = ?"
  ).get(id) ?? null;
}

export function getSkillByName(db: Database, name: string): Skill | null {
  return db.query<Skill, [string]>(
    "SELECT * FROM registry_skills WHERE name = ?"
  ).get(name) ?? null;
}

export interface ListSkillsOptions {
  status?: string;
  tag?: string;
  sort?: "newest" | "stars" | "installs" | "trending";
  limit?: number;
  offset?: number;
}

export function listSkills(db: Database, opts: ListSkillsOptions = {}): { skills: SkillWithAuthor[]; total: number } {
  const limit = Math.min(opts.limit ?? 50, 100);
  const offset = opts.offset ?? 0;
  const conditions: string[] = [];
  const params: any[] = [];

  if (opts.status) {
    conditions.push("s.status = ?");
    params.push(opts.status);
  }

  if (opts.tag) {
    conditions.push("s.tags LIKE ?");
    params.push(`%"${opts.tag}"%`);
  }

  const where = conditions.length > 0 ? "WHERE " + conditions.join(" AND ") : "";

  let orderBy: string;
  switch (opts.sort) {
    case "stars":
      orderBy = "s.stars_count DESC, s.created_at DESC";
      break;
    case "installs":
      orderBy = "s.install_count DESC, s.created_at DESC";
      break;
    case "trending":
      orderBy = "s.install_count DESC, s.stars_count DESC, s.created_at DESC";
      break;
    case "newest":
    default:
      orderBy = "s.created_at DESC";
  }

  const totalRow = db.query<{ count: number }, any[]>(
    `SELECT COUNT(*) as count FROM registry_skills s ${where}`
  ).get(...params);
  const total = totalRow?.count ?? 0;

  const skills = db.query<SkillWithAuthor, any[]>(
    `SELECT s.*, p.username as author_username, p.avatar_url as author_avatar_url
     FROM registry_skills s
     JOIN registry_profiles p ON s.author_id = p.id
     ${where}
     ORDER BY ${orderBy}
     LIMIT ? OFFSET ?`
  ).all(...params, limit, offset);

  return { skills, total };
}

export function searchSkills(db: Database, query: string, limit: number = 20): SkillWithAuthor[] {
  if (!query || query.trim().length === 0) return [];

  const sanitized = query
    .replace(/[^\w\s-]/g, "")
    .trim()
    .split(/\s+/)
    .filter(Boolean)
    .map((w) => `"${w}"*`)
    .join(" ");

  if (!sanitized) return [];

  return db.query<SkillWithAuthor, [string, number]>(
    `SELECT s.*, p.username as author_username, p.avatar_url as author_avatar_url
     FROM registry_skills s
     JOIN registry_profiles p ON s.author_id = p.id
     WHERE s.id IN (
       SELECT rowid FROM registry_skills_fts WHERE registry_skills_fts MATCH ?
     )
     ORDER BY s.stars_count DESC
     LIMIT ?`
  ).all(sanitized, limit);
}

export function deleteSkill(db: Database, id: number): void {
  db.prepare("DELETE FROM registry_skills WHERE id = ?").run(id);
}

export function updateSkillStatus(db: Database, id: number, status: "approved" | "flagged" | "rejected"): void {
  db.prepare(
    "UPDATE registry_skills SET status = ?, updated_at = datetime('now') WHERE id = ?"
  ).run(status, id);
}

// ─── Social ──────────────────────────────────────────────────────────

export function toggleStar(db: Database, skillId: number, profileId: number): boolean {
  const existing = db.query<{ id: number }, [number, number]>(
    "SELECT id FROM registry_stars WHERE skill_id = ? AND profile_id = ?"
  ).get(skillId, profileId);

  if (existing) {
    db.prepare("DELETE FROM registry_stars WHERE skill_id = ? AND profile_id = ?").run(skillId, profileId);
    db.prepare("UPDATE registry_skills SET stars_count = MAX(stars_count - 1, 0) WHERE id = ?").run(skillId);
    return false;
  }

  db.prepare("INSERT INTO registry_stars (skill_id, profile_id) VALUES (?, ?)").run(skillId, profileId);
  db.prepare("UPDATE registry_skills SET stars_count = stars_count + 1 WHERE id = ?").run(skillId);
  return true;
}

export function recordInstall(db: Database, skillId: number, fingerprint?: string): void {
  db.prepare("INSERT INTO registry_installs (skill_id, user_fingerprint) VALUES (?, ?)").run(
    skillId,
    fingerprint ?? null
  );
  db.prepare("UPDATE registry_skills SET install_count = install_count + 1 WHERE id = ?").run(skillId);
}

export function reportSkill(
  db: Database,
  skillId: number,
  email: string,
  reason: string,
  details?: string
): void {
  if (!email || !email.includes("@")) {
    throw new Error("A valid email address is required to submit a report");
  }
  if (!reason) {
    throw new Error("A reason is required");
  }
  db.prepare(
    "INSERT INTO registry_reports (skill_id, reporter_email, reason, details) VALUES (?, ?, ?, ?)"
  ).run(skillId, email, reason, details ?? null);
  db.prepare("UPDATE registry_skills SET report_count = report_count + 1 WHERE id = ?").run(skillId);
}

export function getUserStars(db: Database, profileId: number): number[] {
  return db.query<{ skill_id: number }, [number]>(
    "SELECT skill_id FROM registry_stars WHERE profile_id = ?"
  ).all(profileId).map((r) => r.skill_id);
}

// ─── Lists ───────────────────────────────────────────────────────────

export function getTrendingSkills(db: Database, limit: number = 20): SkillWithAuthor[] {
  return db.query<SkillWithAuthor, [string, number]>(
    `SELECT s.*, p.username as author_username, p.avatar_url as author_avatar_url,
       (SELECT COUNT(*) FROM registry_installs ri
        WHERE ri.skill_id = s.id AND ri.installed_at >= ?) as recent_installs
     FROM registry_skills s
     JOIN registry_profiles p ON s.author_id = p.id
     WHERE s.status = 'approved'
     ORDER BY recent_installs DESC, s.stars_count DESC
     LIMIT ?`
  ).all(new Date(Date.now() - 7 * 86400_000).toISOString(), limit);
}

export function getPopularSkills(db: Database, limit: number = 20): SkillWithAuthor[] {
  return db.query<SkillWithAuthor, [number]>(
    `SELECT s.*, p.username as author_username, p.avatar_url as author_avatar_url
     FROM registry_skills s
     JOIN registry_profiles p ON s.author_id = p.id
     WHERE s.status = 'approved'
     ORDER BY s.stars_count DESC, s.install_count DESC
     LIMIT ?`
  ).all(limit);
}

export function getNewestSkills(db: Database, limit: number = 20): SkillWithAuthor[] {
  return db.query<SkillWithAuthor, [number]>(
    `SELECT s.*, p.username as author_username, p.avatar_url as author_avatar_url
     FROM registry_skills s
     JOIN registry_profiles p ON s.author_id = p.id
     WHERE s.status = 'approved'
     ORDER BY s.created_at DESC
     LIMIT ?`
  ).all(limit);
}

export function getTagCounts(db: Database): Record<string, number> {
  const skills = db.query<{ tags: string }, []>(
    "SELECT tags FROM registry_skills WHERE status = 'approved'"
  ).all();

  const counts: Record<string, number> = {};
  for (const skill of skills) {
    try {
      const tags = JSON.parse(skill.tags) as string[];
      for (const tag of tags) {
        counts[tag] = (counts[tag] ?? 0) + 1;
      }
    } catch {}
  }
  return counts;
}

// ─── Admin ───────────────────────────────────────────────────────────

export function getOpenReports(db: Database): Array<any> {
  return db.query<any, []>(
    `SELECT r.*, s.name as skill_name
     FROM registry_reports r
     JOIN registry_skills s ON r.skill_id = s.id
     WHERE r.status = 'open'
     ORDER BY r.created_at DESC`
  ).all();
}

export function updateReportStatus(db: Database, reportId: number, status: "resolved" | "dismissed"): void {
  db.prepare(
    "UPDATE registry_reports SET status = ?, updated_at = datetime('now') WHERE id = ?"
  ).run(status, reportId);
}

export function getProfileSkills(db: Database, profileId: number): SkillWithAuthor[] {
  return db.query<SkillWithAuthor, [number]>(
    `SELECT s.*, p.username as author_username, p.avatar_url as author_avatar_url
     FROM registry_skills s
     JOIN registry_profiles p ON s.author_id = p.id
     WHERE s.author_id = ?
     ORDER BY s.created_at DESC`
  ).all(profileId);
}
