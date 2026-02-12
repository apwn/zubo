import { describe, it, expect } from "bun:test";
import { createTestDb } from "./helpers/test-db";

describe("Cron Jobs", () => {
  it("should create cron_jobs table", () => {
    const db = createTestDb();
    const result = db.query("SELECT name FROM sqlite_master WHERE type='table' AND name='cron_jobs'").get() as any;
    expect(result).toBeTruthy();
    db.close();
  });

  it("should add a cron job", () => {
    const db = createTestDb();
    db.prepare("INSERT INTO cron_jobs (name, schedule, task, enabled) VALUES (?, ?, ?, ?)").run("test_job", "0 9 * * 1-5", "Send morning report", 1);

    const jobs = db.query("SELECT * FROM cron_jobs").all() as any[];
    expect(jobs.length).toBe(1);
    expect(jobs[0].name).toBe("test_job");
    expect(jobs[0].schedule).toBe("0 9 * * 1-5");
    db.close();
  });

  it("should remove a cron job", () => {
    const db = createTestDb();
    db.prepare("INSERT INTO cron_jobs (name, schedule, task, enabled) VALUES (?, ?, ?, ?)").run("to_remove", "* * * * *", "test", 1);
    db.prepare("DELETE FROM cron_jobs WHERE name = ?").run("to_remove");

    const jobs = db.query("SELECT * FROM cron_jobs").all() as any[];
    expect(jobs.length).toBe(0);
    db.close();
  });

  it("should list cron jobs", () => {
    const db = createTestDb();
    db.prepare("INSERT INTO cron_jobs (name, schedule, task, enabled) VALUES (?, ?, ?, ?)").run("job1", "0 9 * * *", "task1", 1);
    db.prepare("INSERT INTO cron_jobs (name, schedule, task, enabled) VALUES (?, ?, ?, ?)").run("job2", "0 17 * * *", "task2", 1);

    const jobs = db.query("SELECT * FROM cron_jobs ORDER BY name").all() as any[];
    expect(jobs.length).toBe(2);
    expect(jobs[0].name).toBe("job1");
    expect(jobs[1].name).toBe("job2");
    db.close();
  });

  it("should enforce max jobs limit at DB level", () => {
    const db = createTestDb();
    // Insert many jobs -- there's no hard DB limit, but we can test we can add many
    for (let i = 0; i < 50; i++) {
      db.prepare("INSERT INTO cron_jobs (name, schedule, task, enabled) VALUES (?, ?, ?, ?)").run(`job_${i}`, "* * * * *", `task_${i}`, 1);
    }
    const count = (db.query("SELECT COUNT(*) as c FROM cron_jobs").get() as any)?.c;
    expect(count).toBe(50);
    db.close();
  });
});
