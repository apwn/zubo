import { describe, test, expect, beforeEach } from "bun:test";
import { Database } from "bun:sqlite";
import { readFileSync } from "fs";
import { join } from "path";

import {
  scanHandlerCode,
  createOrUpdateProfile,
  createSessionToken,
  getProfileByToken,
  clearSessionToken,
  getAuthorStats,
  updateProfile,
  submitSkill,
  getSkillById,
  getSkillByName,
  listSkills,
  searchSkills,
  deleteSkill,
  updateSkillStatus,
  toggleStar,
  getUserStars,
  recordInstall,
  reportSkill,
  getTrendingSkills,
  getPopularSkills,
  getNewestSkills,
  getTagCounts,
  type SubmitSkillInput,
  type GitHubUser,
} from "../src/registry/skill-registry";

// ─── Helpers ────────────────────────────────────────────────────────────

const MIGRATION_PATH = join(__dirname, "..", "migrations", "023_skill_registry.sql");

function setupTestDb(): Database {
  const db = new Database(":memory:");
  const migrationSql = readFileSync(MIGRATION_PATH, "utf-8");
  const statements = migrationSql
    .split(";")
    .map((s) => s.trim())
    .filter((s) => s.length > 0);
  for (const stmt of statements) {
    db.exec(stmt);
  }
  return db;
}

function createTestProfile(db: Database, overrides: Partial<GitHubUser> = {}): ReturnType<typeof createOrUpdateProfile> {
  const defaults: GitHubUser = {
    id: 12345,
    login: "testuser",
    name: "Test User",
    bio: "A test bio",
    html_url: "https://github.com/testuser",
    avatar_url: "https://avatars.githubusercontent.com/u/12345",
    email: "test@example.com",
  };
  return createOrUpdateProfile(db, { ...defaults, ...overrides });
}

function createTestSkillInput(overrides: Partial<SubmitSkillInput> = {}): SubmitSkillInput {
  const defaults: SubmitSkillInput = {
    name: "test-skill",
    description: "A test skill for unit testing purposes",
    handler_code:
      'export const skill = { name: "test-skill", description: "test" };\nexport default async function(input) { return "ok"; }',
    version: "1.0.0",
    tags: ["test"],
    secrets: [],
  };
  return { ...defaults, ...overrides };
}

// ─── Scanner Tests ──────────────────────────────────────────────────────

describe("scanHandlerCode", () => {
  test("clean code with no patterns returns low risk and approved", () => {
    const code = 'export default function(input) { return "hello"; }';
    const result = scanHandlerCode(code);
    expect(result.risk_level).toBe("low");
    expect(result.status).toBe("approved");
    expect(result.findings).toEqual([]);
  });

  test("code with eval( is rejected as high risk", () => {
    const code = 'const result = eval("1 + 2");';
    const result = scanHandlerCode(code);
    expect(result.risk_level).toBe("high");
    expect(result.status).toBe("rejected");
    expect(result.findings.length).toBeGreaterThanOrEqual(1);
    expect(result.findings.some((f) => f.severity === "high")).toBe(true);
  });

  test("code with new Function( is rejected as high risk", () => {
    const code = 'const fn = new Function("return 42");';
    const result = scanHandlerCode(code);
    expect(result.risk_level).toBe("high");
    expect(result.status).toBe("rejected");
    expect(result.findings.some((f) => f.description.includes("Function constructor"))).toBe(true);
  });

  test("code with atob( is rejected as high risk", () => {
    const code = 'const decoded = atob("SGVsbG8=");';
    const result = scanHandlerCode(code);
    expect(result.risk_level).toBe("high");
    expect(result.status).toBe("rejected");
    expect(result.findings.some((f) => f.description.includes("atob"))).toBe(true);
  });

  test("code with long hex string (40+ chars) is rejected", () => {
    const hexString = "a".repeat(42);
    const code = `const secret = "${hexString}";`;
    const result = scanHandlerCode(code);
    expect(result.risk_level).toBe("high");
    expect(result.status).toBe("rejected");
    expect(result.findings.some((f) => f.description.includes("hex string"))).toBe(true);
  });

  test("code with pastebin.com or bit.ly is rejected", () => {
    const code1 = 'const url = "https://pastebin.com/raw/abc123";';
    const result1 = scanHandlerCode(code1);
    expect(result1.risk_level).toBe("high");
    expect(result1.status).toBe("rejected");

    const code2 = 'const url = "https://bit.ly/abc123";';
    const result2 = scanHandlerCode(code2);
    expect(result2.risk_level).toBe("high");
    expect(result2.status).toBe("rejected");
  });

  test("code with process.env.HOME is rejected", () => {
    const code = "const home = process.env.HOME;";
    const result = scanHandlerCode(code);
    expect(result.risk_level).toBe("high");
    expect(result.status).toBe("rejected");
    expect(result.findings.some((f) => f.description.includes("sensitive environment"))).toBe(true);
  });

  test("code with fetch( (no high risk) is flagged as medium risk", () => {
    const code = 'const data = await fetch("https://api.example.com/data");';
    const result = scanHandlerCode(code);
    expect(result.risk_level).toBe("medium");
    expect(result.status).toBe("flagged");
    expect(result.findings.some((f) => f.severity === "medium")).toBe(true);
  });

  test("code with Bun.spawn is flagged as medium risk", () => {
    const code = 'const proc = Bun.spawn(["ls", "-la"]);';
    const result = scanHandlerCode(code);
    expect(result.risk_level).toBe("medium");
    expect(result.status).toBe("flagged");
    expect(result.findings.some((f) => f.description.includes("Process spawning"))).toBe(true);
  });

  test("empty code returns approved with low risk", () => {
    const result = scanHandlerCode("");
    expect(result.risk_level).toBe("low");
    expect(result.status).toBe("approved");
    expect(result.findings).toEqual([]);
  });

  test("code with BOTH high and medium risks is rejected (highest severity wins)", () => {
    const code = [
      'const evil = eval("1+2");',
      'const data = await fetch("https://example.com");',
    ].join("\n");
    const result = scanHandlerCode(code);
    expect(result.risk_level).toBe("high");
    expect(result.status).toBe("rejected");
    const highFindings = result.findings.filter((f) => f.severity === "high");
    const mediumFindings = result.findings.filter((f) => f.severity === "medium");
    expect(highFindings.length).toBeGreaterThanOrEqual(1);
    expect(mediumFindings.length).toBeGreaterThanOrEqual(1);
  });
});

// ─── Profile & Auth Tests ───────────────────────────────────────────────

describe("Profile & Auth", () => {
  let db: Database;

  beforeEach(() => {
    db = setupTestDb();
  });

  test("createOrUpdateProfile creates a new profile from GitHub data", () => {
    const profile = createTestProfile(db);
    expect(profile.id).toBeDefined();
    expect(typeof profile.id).toBe("number");
    expect(profile.github_id).toBe(12345);
    expect(profile.username).toBe("testuser");
    expect(profile.display_name).toBe("Test User");
    expect(profile.bio).toBe("A test bio");
    expect(profile.github_url).toBe("https://github.com/testuser");
    expect(profile.avatar_url).toBe("https://avatars.githubusercontent.com/u/12345");
    expect(profile.email).toBe("test@example.com");
    expect(profile.created_at).toBeDefined();
  });

  test("createOrUpdateProfile upserts on second call with same github_id", () => {
    const profile1 = createTestProfile(db);
    const profile2 = createOrUpdateProfile(db, {
      id: 12345,
      login: "testuser-updated",
      name: "Updated Name",
      bio: "Updated bio",
      html_url: "https://github.com/testuser-updated",
      avatar_url: "https://avatars.githubusercontent.com/u/12345",
      email: "updated@example.com",
    });

    expect(profile2.id).toBe(profile1.id);
    expect(profile2.username).toBe("testuser-updated");
    expect(profile2.display_name).toBe("Updated Name");
    expect(profile2.bio).toBe("Updated bio");
    expect(profile2.email).toBe("updated@example.com");
  });

  test("createSessionToken returns a non-empty string and stores it in DB", () => {
    const profile = createTestProfile(db);
    const token = createSessionToken(db, profile.id);
    expect(typeof token).toBe("string");
    expect(token.length).toBeGreaterThan(0);

    // Verify token is stored in the database
    const row = db
      .query<{ session_token: string }, [number]>("SELECT session_token FROM registry_profiles WHERE id = ?")
      .get(profile.id);
    expect(row?.session_token).toBe(token);
  });

  test("getProfileByToken returns the correct profile", () => {
    const profile = createTestProfile(db);
    const token = createSessionToken(db, profile.id);
    const fetched = getProfileByToken(db, token);
    expect(fetched).not.toBeNull();
    expect(fetched!.id).toBe(profile.id);
    expect(fetched!.username).toBe("testuser");
  });

  test("getProfileByToken with invalid token returns null", () => {
    createTestProfile(db);
    const result = getProfileByToken(db, "invalid-token-that-does-not-exist");
    expect(result).toBeNull();
  });

  test("clearSessionToken clears the token so getProfileByToken returns null", () => {
    const profile = createTestProfile(db);
    const token = createSessionToken(db, profile.id);
    expect(getProfileByToken(db, token)).not.toBeNull();

    clearSessionToken(db, profile.id);
    expect(getProfileByToken(db, token)).toBeNull();
  });

  test("getAuthorStats returns correct stats for a profile", () => {
    const profile = createTestProfile(db);
    // Initially no skills
    const stats = getAuthorStats(db, profile.id);
    expect(stats.skills_count).toBe(0);
    expect(stats.total_stars).toBe(0);
    expect(stats.total_installs).toBe(0);

    // Submit a skill and check again
    submitSkill(db, createTestSkillInput(), profile.id);
    const statsAfter = getAuthorStats(db, profile.id);
    expect(statsAfter.skills_count).toBe(1);
  });

  test("updateProfile updates the display_name field", () => {
    const profile = createTestProfile(db);
    updateProfile(db, profile.id, { display_name: "New Name" });

    const row = db
      .query<{ display_name: string }, [number]>("SELECT display_name FROM registry_profiles WHERE id = ?")
      .get(profile.id);
    expect(row?.display_name).toBe("New Name");
  });
});

// ─── Skill CRUD Tests ───────────────────────────────────────────────────

describe("Skill CRUD", () => {
  let db: Database;
  let authorId: number;

  beforeEach(() => {
    db = setupTestDb();
    const profile = createTestProfile(db);
    authorId = profile.id;
  });

  test("submitSkill creates a skill and returns skill + review", () => {
    const input = createTestSkillInput();
    const { skill, review } = submitSkill(db, input, authorId);
    expect(skill).toBeDefined();
    expect(skill.id).toBeDefined();
    expect(skill.name).toBe("test-skill");
    expect(skill.description).toBe("A test skill for unit testing purposes");
    expect(skill.author_id).toBe(authorId);
    expect(skill.version).toBe("1.0.0");
    expect(review).toBeDefined();
    expect(review.risk_level).toBe("low");
    expect(review.status).toBe("approved");
  });

  test("submitSkill with invalid name (uppercase) throws", () => {
    const input = createTestSkillInput({ name: "InvalidName" });
    expect(() => submitSkill(db, input, authorId)).toThrow("Invalid skill name");
  });

  test("submitSkill with invalid name (special chars) throws", () => {
    const input = createTestSkillInput({ name: "test skill!@#" });
    expect(() => submitSkill(db, input, authorId)).toThrow("Invalid skill name");
  });

  test("submitSkill with short description (< 10 chars) throws", () => {
    const input = createTestSkillInput({ description: "Short" });
    expect(() => submitSkill(db, input, authorId)).toThrow("Description must be at least 10 characters");
  });

  test("submitSkill with oversized handler_code (> 100000 chars) throws", () => {
    const input = createTestSkillInput({ handler_code: "x".repeat(100_001) });
    expect(() => submitSkill(db, input, authorId)).toThrow("Handler code must be between 1 and 100,000 characters");
  });

  test("submitSkill with duplicate name throws 'already exists'", () => {
    const input = createTestSkillInput();
    submitSkill(db, input, authorId);
    expect(() => submitSkill(db, input, authorId)).toThrow("already exists");
  });

  test("getSkillById returns the correct skill", () => {
    const { skill } = submitSkill(db, createTestSkillInput(), authorId);
    const fetched = getSkillById(db, skill.id);
    expect(fetched).not.toBeNull();
    expect(fetched!.id).toBe(skill.id);
    expect(fetched!.name).toBe("test-skill");
  });

  test("getSkillByName returns the correct skill", () => {
    submitSkill(db, createTestSkillInput(), authorId);
    const fetched = getSkillByName(db, "test-skill");
    expect(fetched).not.toBeNull();
    expect(fetched!.name).toBe("test-skill");
  });

  test("listSkills with status filter returns matching skills", () => {
    submitSkill(db, createTestSkillInput({ name: "approved-skill" }), authorId);
    submitSkill(
      db,
      createTestSkillInput({
        name: "risky-skill",
        handler_code: 'const data = await fetch("https://example.com/api");',
      }),
      authorId
    );

    const { skills: approved } = listSkills(db, { status: "approved" });
    const { skills: flagged } = listSkills(db, { status: "flagged" });

    expect(approved.length).toBe(1);
    expect(approved[0].name).toBe("approved-skill");
    expect(flagged.length).toBe(1);
    expect(flagged[0].name).toBe("risky-skill");
  });

  test("listSkills with sort='stars' returns skills sorted by stars_count DESC", () => {
    const { skill: s1 } = submitSkill(db, createTestSkillInput({ name: "low-stars" }), authorId);
    const { skill: s2 } = submitSkill(db, createTestSkillInput({ name: "high-stars" }), authorId);

    // Manually set star counts
    db.prepare("UPDATE registry_skills SET stars_count = ? WHERE id = ?").run(5, s1.id);
    db.prepare("UPDATE registry_skills SET stars_count = ? WHERE id = ?").run(20, s2.id);

    const { skills } = listSkills(db, { sort: "stars" });
    expect(skills.length).toBe(2);
    expect(skills[0].name).toBe("high-stars");
    expect(skills[1].name).toBe("low-stars");
  });

  test("listSkills with tag filter returns skills that have the tag", () => {
    submitSkill(db, createTestSkillInput({ name: "weather-skill", tags: ["weather", "api"] }), authorId);
    submitSkill(db, createTestSkillInput({ name: "math-skill", tags: ["math"] }), authorId);

    const { skills } = listSkills(db, { tag: "weather" });
    expect(skills.length).toBe(1);
    expect(skills[0].name).toBe("weather-skill");
  });

  test("searchSkills returns matching skills via FTS5", () => {
    submitSkill(
      db,
      createTestSkillInput({
        name: "weather-forecast",
        description: "Get weather forecasts for any city worldwide",
      }),
      authorId
    );
    submitSkill(
      db,
      createTestSkillInput({
        name: "math-calculator",
        description: "Perform mathematical calculations quickly",
      }),
      authorId
    );

    const results = searchSkills(db, "weather", 10);
    expect(results.length).toBeGreaterThanOrEqual(1);
    expect(results.some((s) => s.name === "weather-forecast")).toBe(true);
  });

  test("deleteSkill removes the skill so it is no longer found", () => {
    const { skill } = submitSkill(db, createTestSkillInput(), authorId);
    expect(getSkillById(db, skill.id)).not.toBeNull();

    deleteSkill(db, skill.id);
    expect(getSkillById(db, skill.id)).toBeNull();
  });

  test("updateSkillStatus changes the skill status", () => {
    const { skill } = submitSkill(db, createTestSkillInput(), authorId);
    expect(skill.status).toBe("approved");

    updateSkillStatus(db, skill.id, "rejected");
    const updated = getSkillById(db, skill.id);
    expect(updated!.status).toBe("rejected");
  });
});

// ─── Social Tests ───────────────────────────────────────────────────────

describe("Social", () => {
  let db: Database;
  let authorId: number;
  let skillId: number;

  beforeEach(() => {
    db = setupTestDb();
    const profile = createTestProfile(db);
    authorId = profile.id;
    const { skill } = submitSkill(db, createTestSkillInput(), authorId);
    skillId = skill.id;
  });

  test("toggleStar returns true on first call (starred) and increments stars_count", () => {
    const starrer = createTestProfile(db, { id: 99999, login: "starrer", email: "starrer@example.com" });
    const result = toggleStar(db, skillId, starrer.id);
    expect(result).toBe(true);

    const skill = getSkillById(db, skillId);
    expect(skill!.stars_count).toBe(1);
  });

  test("toggleStar returns false on second call (unstarred) and decrements stars_count", () => {
    const starrer = createTestProfile(db, { id: 99999, login: "starrer", email: "starrer@example.com" });
    toggleStar(db, skillId, starrer.id); // star
    const result = toggleStar(db, skillId, starrer.id); // unstar
    expect(result).toBe(false);

    const skill = getSkillById(db, skillId);
    expect(skill!.stars_count).toBe(0);
  });

  test("double star is handled by toggle (UNIQUE constraint)", () => {
    const starrer = createTestProfile(db, { id: 99999, login: "starrer", email: "starrer@example.com" });
    toggleStar(db, skillId, starrer.id); // star
    toggleStar(db, skillId, starrer.id); // unstar
    toggleStar(db, skillId, starrer.id); // star again

    const skill = getSkillById(db, skillId);
    expect(skill!.stars_count).toBe(1);

    // Verify only one star entry exists
    const stars = db
      .query<{ count: number }, [number, number]>(
        "SELECT COUNT(*) as count FROM registry_stars WHERE skill_id = ? AND profile_id = ?"
      )
      .get(skillId, starrer.id);
    expect(stars!.count).toBe(1);
  });

  test("getUserStars returns array of starred skill IDs", () => {
    const starrer = createTestProfile(db, { id: 99999, login: "starrer", email: "starrer@example.com" });

    // Create a second skill
    const { skill: skill2 } = submitSkill(
      db,
      createTestSkillInput({ name: "second-skill" }),
      authorId
    );

    toggleStar(db, skillId, starrer.id);
    toggleStar(db, skill2.id, starrer.id);

    const stars = getUserStars(db, starrer.id);
    expect(stars).toContain(skillId);
    expect(stars).toContain(skill2.id);
    expect(stars.length).toBe(2);
  });

  test("recordInstall increments install_count with fingerprint", () => {
    recordInstall(db, skillId, "fp-abc123");
    const skill = getSkillById(db, skillId);
    expect(skill!.install_count).toBe(1);

    // Verify install record
    const row = db
      .query<{ user_fingerprint: string }, [number]>(
        "SELECT user_fingerprint FROM registry_installs WHERE skill_id = ?"
      )
      .get(skillId);
    expect(row!.user_fingerprint).toBe("fp-abc123");
  });

  test("recordInstall works without fingerprint", () => {
    recordInstall(db, skillId);
    const skill = getSkillById(db, skillId);
    expect(skill!.install_count).toBe(1);

    const row = db
      .query<{ user_fingerprint: string | null }, [number]>(
        "SELECT user_fingerprint FROM registry_installs WHERE skill_id = ?"
      )
      .get(skillId);
    expect(row!.user_fingerprint).toBeNull();
  });

  test("reportSkill creates a report and increments report_count", () => {
    reportSkill(db, skillId, "reporter@example.com", "spam");
    const skill = getSkillById(db, skillId);
    expect(skill!.report_count).toBe(1);

    const report = db
      .query<{ reporter_email: string; reason: string; status: string }, [number]>(
        "SELECT reporter_email, reason, status FROM registry_reports WHERE skill_id = ?"
      )
      .get(skillId);
    expect(report!.reporter_email).toBe("reporter@example.com");
    expect(report!.reason).toBe("spam");
    expect(report!.status).toBe("open");
  });

  test("reportSkill with empty email throws", () => {
    expect(() => reportSkill(db, skillId, "", "spam")).toThrow("email");
  });

  test("reportSkill with empty reason throws", () => {
    expect(() => reportSkill(db, skillId, "test@example.com", "")).toThrow("reason");
  });

  test("getTrendingSkills returns skills ordered by recent installs", () => {
    const { skill: skill2 } = submitSkill(
      db,
      createTestSkillInput({ name: "trending-skill" }),
      authorId
    );

    // Add more installs to the second skill
    recordInstall(db, skill2.id, "fp-1");
    recordInstall(db, skill2.id, "fp-2");
    recordInstall(db, skill2.id, "fp-3");
    recordInstall(db, skillId, "fp-4");

    const trending = getTrendingSkills(db, 10);
    expect(trending.length).toBeGreaterThanOrEqual(2);
    // The skill with more installs should appear first
    expect(trending[0].name).toBe("trending-skill");
  });

  test("getPopularSkills returns skills ordered by stars", () => {
    const { skill: skill2 } = submitSkill(
      db,
      createTestSkillInput({ name: "popular-skill" }),
      authorId
    );

    // Give skill2 more stars
    db.prepare("UPDATE registry_skills SET stars_count = ? WHERE id = ?").run(10, skill2.id);
    db.prepare("UPDATE registry_skills SET stars_count = ? WHERE id = ?").run(2, skillId);

    const popular = getPopularSkills(db, 10);
    expect(popular.length).toBe(2);
    expect(popular[0].name).toBe("popular-skill");
    expect(popular[0].stars_count).toBe(10);
  });

  test("getNewestSkills returns skills ordered by created_at DESC", () => {
    // Create skills with explicit timestamps so ordering is deterministic
    db.prepare("UPDATE registry_skills SET created_at = '2025-01-01T00:00:00Z' WHERE id = ?").run(skillId);

    const { skill: skill2 } = submitSkill(
      db,
      createTestSkillInput({ name: "newest-skill" }),
      authorId
    );
    db.prepare("UPDATE registry_skills SET created_at = '2025-06-01T00:00:00Z' WHERE id = ?").run(skill2.id);

    const newest = getNewestSkills(db, 10);
    expect(newest.length).toBe(2);
    expect(newest[0].name).toBe("newest-skill");
  });

  test("getTagCounts returns correct tag counts across approved skills", () => {
    // The existing test-skill has tags: ["test"]
    submitSkill(
      db,
      createTestSkillInput({
        name: "weather-skill",
        tags: ["weather", "api"],
      }),
      authorId
    );
    submitSkill(
      db,
      createTestSkillInput({
        name: "api-skill",
        tags: ["api", "test"],
      }),
      authorId
    );

    const counts = getTagCounts(db);
    expect(counts["test"]).toBe(2);
    expect(counts["api"]).toBe(2);
    expect(counts["weather"]).toBe(1);
  });
});
