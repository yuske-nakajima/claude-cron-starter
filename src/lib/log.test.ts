import { afterEach, beforeEach, describe, expect, test } from "bun:test";
import { mkdir, readdir, readFile, rm, writeFile } from "node:fs/promises";
import { join } from "node:path";
import type { JobLogEntry } from "./log";
import { appendJobLog, cleanupOldLogs, getLogDir } from "./log";

const BASE_TMP = join(
  import.meta.dir,
  "..",
  "..",
  "node_modules",
  ".tmp-test-log",
);

function makeEntry(overrides: Partial<JobLogEntry> = {}): JobLogEntry {
  return {
    jobName: "test-job",
    startedAt: "2026-07-07T10:00:00.000Z",
    finishedAt: "2026-07-07T10:00:01.000Z",
    durationMs: 1000,
    status: "success",
    ...overrides,
  };
}

// --- getLogDir ---

describe("getLogDir", () => {
  let saved: string | undefined;

  beforeEach(() => {
    saved = process.env.LOG_DIR;
  });

  afterEach(() => {
    if (saved === undefined) {
      delete process.env.LOG_DIR;
    } else {
      process.env.LOG_DIR = saved;
    }
  });

  test("returns LOG_DIR value when set", () => {
    process.env.LOG_DIR = "/some/path";
    expect(getLogDir()).toBe("/some/path");
  });

  test("returns null when LOG_DIR is not set", () => {
    delete process.env.LOG_DIR;
    expect(getLogDir()).toBeNull();
  });

  test("returns null when LOG_DIR is empty string", () => {
    process.env.LOG_DIR = "";
    expect(getLogDir()).toBeNull();
  });
});

// --- appendJobLog ---

describe("appendJobLog", () => {
  let tmpDir: string;
  let saved: string | undefined;

  beforeEach(async () => {
    saved = process.env.LOG_DIR;
    tmpDir = join(BASE_TMP, `append-${Date.now()}-${Math.random()}`);
    process.env.LOG_DIR = tmpDir;
  });

  afterEach(async () => {
    if (saved === undefined) {
      delete process.env.LOG_DIR;
    } else {
      process.env.LOG_DIR = saved;
    }
    await rm(tmpDir, { recursive: true, force: true });
  });

  test("writes a JSONL line to YYYY-MM-DD.jsonl", async () => {
    const entry = makeEntry({ startedAt: "2026-07-07T10:00:00.000Z" });
    await appendJobLog(entry);

    const content = await readFile(join(tmpDir, "2026-07-07.jsonl"), "utf8");
    const lines = content.trimEnd().split("\n");
    expect(lines).toHaveLength(1);

    const parsed: unknown = JSON.parse(lines[0] ?? "");
    expect(parsed).toEqual(entry);
  });

  test("appends multiple entries to the same file", async () => {
    const entry1 = makeEntry({
      startedAt: "2026-07-07T10:00:00.000Z",
      jobName: "job-1",
    });
    const entry2 = makeEntry({
      startedAt: "2026-07-07T11:00:00.000Z",
      jobName: "job-2",
    });
    await appendJobLog(entry1);
    await appendJobLog(entry2);

    const content = await readFile(join(tmpDir, "2026-07-07.jsonl"), "utf8");
    const lines = content.trimEnd().split("\n");
    expect(lines).toHaveLength(2);

    const parsed0 = JSON.parse(lines[0] ?? "") as { jobName: string };
    const parsed1 = JSON.parse(lines[1] ?? "") as { jobName: string };
    expect(parsed0.jobName).toBe("job-1");
    expect(parsed1.jobName).toBe("job-2");
  });

  test("creates directory automatically when it does not exist", async () => {
    const nestedDir = join(tmpDir, "nested", "deep");
    process.env.LOG_DIR = nestedDir;

    await appendJobLog(makeEntry());

    const files = await readdir(nestedDir);
    expect(files).toHaveLength(1);
    expect(files[0]).toBe("2026-07-07.jsonl");
  });

  test("file name is derived from startedAt date part", async () => {
    await appendJobLog(makeEntry({ startedAt: "2025-12-31T23:59:59.000Z" }));

    const files = await readdir(tmpDir);
    expect(files).toContain("2025-12-31.jsonl");
  });

  test("does nothing when LOG_DIR is not set", async () => {
    delete process.env.LOG_DIR;
    await appendJobLog(makeEntry());
    const exists = await readdir(tmpDir).then(
      () => true,
      () => false,
    );
    expect(exists).toBe(false);
  });
});

// --- cleanupOldLogs ---

describe("cleanupOldLogs", () => {
  let tmpDir: string;
  let saved: string | undefined;

  beforeEach(async () => {
    saved = process.env.LOG_DIR;
    tmpDir = join(BASE_TMP, `cleanup-${Date.now()}-${Math.random()}`);
    await mkdir(tmpDir, { recursive: true });
    process.env.LOG_DIR = tmpDir;
  });

  afterEach(async () => {
    if (saved === undefined) {
      delete process.env.LOG_DIR;
    } else {
      process.env.LOG_DIR = saved;
    }
    await rm(tmpDir, { recursive: true, force: true });
  });

  test("deletes files older than retention days", async () => {
    const oldDate = new Date();
    oldDate.setDate(oldDate.getDate() - 100);
    const oldName = oldDate.toISOString().slice(0, 10);
    await writeFile(join(tmpDir, `${oldName}.jsonl`), "");

    const deleted = await cleanupOldLogs(90);
    expect(deleted).toBe(1);

    const files = await readdir(tmpDir);
    expect(files).not.toContain(`${oldName}.jsonl`);
  });

  test("keeps files within retention days", async () => {
    const recentDate = new Date();
    recentDate.setDate(recentDate.getDate() - 10);
    const recentName = recentDate.toISOString().slice(0, 10);
    await writeFile(join(tmpDir, `${recentName}.jsonl`), "");

    const deleted = await cleanupOldLogs(90);
    expect(deleted).toBe(0);

    const files = await readdir(tmpDir);
    expect(files).toContain(`${recentName}.jsonl`);
  });

  test("returns 0 when LOG_DIR is not set", async () => {
    delete process.env.LOG_DIR;
    const deleted = await cleanupOldLogs();
    expect(deleted).toBe(0);
  });

  test("ignores files that do not match YYYY-MM-DD.jsonl pattern", async () => {
    await writeFile(join(tmpDir, "notes.txt"), "");
    await writeFile(join(tmpDir, "random.jsonl"), "");
    await writeFile(join(tmpDir, "2026-13-01.jsonl"), ""); // invalid month

    const deleted = await cleanupOldLogs(0);
    expect(deleted).toBe(0);

    const files = await readdir(tmpDir);
    expect(files).toHaveLength(3);
  });

  test("returns 0 when LOG_DIR directory does not exist", async () => {
    process.env.LOG_DIR = join(tmpDir, "nonexistent");
    const deleted = await cleanupOldLogs();
    expect(deleted).toBe(0);
  });

  test("uses default retention of 90 days", async () => {
    const oldDate = new Date();
    oldDate.setDate(oldDate.getDate() - 91);
    const oldName = oldDate.toISOString().slice(0, 10);
    await writeFile(join(tmpDir, `${oldName}.jsonl`), "");

    const recentDate = new Date();
    recentDate.setDate(recentDate.getDate() - 89);
    const recentName = recentDate.toISOString().slice(0, 10);
    await writeFile(join(tmpDir, `${recentName}.jsonl`), "");

    const deleted = await cleanupOldLogs();
    expect(deleted).toBe(1);

    const files = await readdir(tmpDir);
    expect(files).toContain(`${recentName}.jsonl`);
    expect(files).not.toContain(`${oldName}.jsonl`);
  });
});
