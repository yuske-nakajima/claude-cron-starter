import { afterEach, beforeEach, describe, expect, test } from "bun:test";
import { mkdir, readdir, readFile, rm } from "node:fs/promises";
import { join } from "node:path";
import { runJobSafely } from "./safe-run";
import type { Job } from "./types";

// --- 既存テスト（変更なし） ---

test("runJobSafely swallows a rejecting job so the resident process survives", async () => {
  const failing: Job = {
    name: "failing",
    schedule: "* * * * *",
    run: () => Promise.reject(new Error("boom")),
  };

  // 例外が外へ伝播しないこと（reject しても resolve で返る）
  await expect(runJobSafely(failing)).resolves.toBeUndefined();
});

test("runJobSafely swallows a synchronously throwing job", async () => {
  const failing: Job = {
    name: "throwing",
    schedule: "* * * * *",
    run: () => {
      throw new Error("sync boom");
    },
  };

  await expect(runJobSafely(failing)).resolves.toBeUndefined();
});

// --- ログ記録のテスト ---

const BASE_TMP = join(
  import.meta.dir,
  "..",
  "node_modules",
  ".tmp-test-safe-run",
);

describe("runJobSafely logging", () => {
  let tmpDir: string;
  let savedLogDir: string | undefined;

  beforeEach(async () => {
    savedLogDir = process.env.LOG_DIR;
    tmpDir = join(BASE_TMP, `run-${Date.now()}-${Math.random()}`);
    await mkdir(tmpDir, { recursive: true });
    process.env.LOG_DIR = tmpDir;
  });

  afterEach(async () => {
    if (savedLogDir === undefined) {
      delete process.env.LOG_DIR;
    } else {
      process.env.LOG_DIR = savedLogDir;
    }
    await rm(tmpDir, { recursive: true, force: true });
  });

  async function readLogEntries(): Promise<Record<string, unknown>[]> {
    const files = await readdir(tmpDir);
    const jsonlFiles = files.filter((f) => f.endsWith(".jsonl"));
    if (jsonlFiles.length === 0) return [];
    const first = jsonlFiles[0];
    if (!first) return [];
    const content = await readFile(join(tmpDir, first), "utf8");
    return content
      .trimEnd()
      .split("\n")
      .map((line) => JSON.parse(line) as Record<string, unknown>);
  }

  test("logs status 'success' when run() returns void", async () => {
    const job: Job = {
      name: "void-job",
      schedule: "* * * * *",
      run: async () => {},
    };

    await runJobSafely(job);

    const entries = await readLogEntries();
    expect(entries).toHaveLength(2);
    expect(entries[1]?.jobName).toBe("void-job");
    expect(entries[1]?.status).toBe("success");
    expect(entries[1]?.durationMs).toBeGreaterThanOrEqual(0);
  });

  test("logs status 'skipped' with skipReason when run() returns skipped result", async () => {
    const job: Job = {
      name: "skip-job",
      schedule: "* * * * *",
      run: async () => ({
        status: "skipped" as const,
        skipReason: "token expired",
      }),
    };

    await runJobSafely(job);

    const entries = await readLogEntries();
    expect(entries).toHaveLength(2);
    expect(entries[1]?.status).toBe("skipped");
    expect(entries[1]?.skipReason).toBe("token expired");
  });

  test("logs status 'failure' with error when run() throws", async () => {
    const job: Job = {
      name: "fail-job",
      schedule: "* * * * *",
      run: async () => {
        throw new Error("something broke");
      },
    };

    await runJobSafely(job);

    const entries = await readLogEntries();
    expect(entries).toHaveLength(2);
    expect(entries[1]?.status).toBe("failure");
    expect(entries[1]?.error).toBe("something broke");
  });

  test("does not write log when LOG_DIR is not set", async () => {
    delete process.env.LOG_DIR;

    const job: Job = {
      name: "no-log-job",
      schedule: "* * * * *",
      run: async () => {},
    };

    await runJobSafely(job);

    const files = await readdir(tmpDir);
    const jsonlFiles = files.filter((f) => f.endsWith(".jsonl"));
    expect(jsonlFiles).toHaveLength(0);
  });

  test("does not reject when log writing fails", async () => {
    const badPath = join(tmpDir, "not-a-dir");
    await Bun.write(badPath, "block");
    process.env.LOG_DIR = join(badPath, "nested");

    const job: Job = {
      name: "robust-job",
      schedule: "* * * * *",
      run: async () => {},
    };

    await expect(runJobSafely(job)).resolves.toBeUndefined();
  });

  test("writes started entry with event, jobName, and startedAt", async () => {
    const job: Job = {
      name: "started-job",
      schedule: "* * * * *",
      run: async () => {},
    };

    await runJobSafely(job);

    const entries = await readLogEntries();
    expect(entries).toHaveLength(2);
    expect(entries[0]?.event).toBe("started");
    expect(entries[0]?.jobName).toBe("started-job");
    expect(typeof entries[0]?.startedAt).toBe("string");
  });

  test("started entry does not contain finishedAt, durationMs, or status", async () => {
    const job: Job = {
      name: "started-fields-job",
      schedule: "* * * * *",
      run: async () => {},
    };

    await runJobSafely(job);

    const entries = await readLogEntries();
    expect(entries).toHaveLength(2);
    const started = entries[0];
    expect(started?.finishedAt).toBeUndefined();
    expect(started?.durationMs).toBeUndefined();
    expect(started?.status).toBeUndefined();
  });

  test("records errorStack in completed entry when run() throws an Error", async () => {
    const job: Job = {
      name: "stack-job",
      schedule: "* * * * *",
      run: async () => {
        throw new Error("stack test");
      },
    };

    await runJobSafely(job);

    const entries = await readLogEntries();
    expect(entries).toHaveLength(2);
    const completed = entries[1];
    expect(completed?.event).toBe("completed");
    expect(completed?.status).toBe("failure");
    expect(typeof completed?.errorStack).toBe("string");
    expect(completed?.errorStack as string).toContain("stack test");
  });

  test("errorStack is undefined when run() throws a non-Error value", async () => {
    const job: Job = {
      name: "non-error-job",
      schedule: "* * * * *",
      run: async () => {
        throw "string error";
      },
    };

    await runJobSafely(job);

    const entries = await readLogEntries();
    expect(entries).toHaveLength(2);
    const completed = entries[1];
    expect(completed?.event).toBe("completed");
    expect(completed?.status).toBe("failure");
    expect(completed?.errorStack).toBeUndefined();
  });
});
