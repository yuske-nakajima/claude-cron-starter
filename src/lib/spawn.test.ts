import { describe, expect, test } from "bun:test";
import { SpawnError, SpawnTimeoutError, spawn } from "./spawn";

describe("spawn", () => {
  test("returns stdout, stderr, exitCode on successful command", async () => {
    const result = await spawn(["echo", "hello"]);
    expect(result.stdout).toBe("hello\n");
    expect(result.stderr).toBe("");
    expect(result.exitCode).toBe(0);
  });

  test("throws SpawnError on non-zero exit code", async () => {
    try {
      await spawn(["bash", "-c", "exit 1"]);
      expect.unreachable("should have thrown");
    } catch (error) {
      expect(error).toBeInstanceOf(SpawnError);
      const spawnError = error as SpawnError;
      expect(spawnError.exitCode).toBe(1);
      expect(spawnError.stdout).toBeDefined();
      expect(spawnError.stderr).toBeDefined();
    }
  });

  test("throws SpawnTimeoutError when command exceeds timeout", async () => {
    try {
      await spawn(["sleep", "10"], { timeout: 100 });
      expect.unreachable("should have thrown");
    } catch (error) {
      expect(error).toBeInstanceOf(SpawnTimeoutError);
      expect(error).toBeInstanceOf(SpawnError);
      const timeoutError = error as SpawnTimeoutError;
      expect(timeoutError.name).toBe("SpawnTimeoutError");
    }
  });

  test("uses cwd option to change working directory", async () => {
    const result = await spawn(["pwd"], { cwd: "/tmp" });
    // macOS: /tmp is a symlink to /private/tmp
    expect(result.stdout.trim()).toMatch(/\/(private\/)?tmp$/);
    expect(result.exitCode).toBe(0);
  });

  test("captures stderr output", async () => {
    const result = await spawn([
      "bash",
      "-c",
      "echo out; echo err >&2; exit 0",
    ]);
    expect(result.stdout).toContain("out");
    expect(result.stderr).toContain("err");
    expect(result.exitCode).toBe(0);
  });

  test("includes stdout and stderr in SpawnError for failed commands", async () => {
    try {
      await spawn(["bash", "-c", "echo fail-out; echo fail-err >&2; exit 42"]);
      expect.unreachable("should have thrown");
    } catch (error) {
      expect(error).toBeInstanceOf(SpawnError);
      const spawnError = error as SpawnError;
      expect(spawnError.exitCode).toBe(42);
      expect(spawnError.stdout).toContain("fail-out");
      expect(spawnError.stderr).toContain("fail-err");
    }
  });

  test("sends SIGKILL when process ignores SIGTERM on timeout", async () => {
    // bash script that traps SIGTERM and ignores it; SIGKILL cannot be trapped.
    // Without the SIGKILL fallback, this test would hang indefinitely.
    const trapScript = "trap '' TERM; echo trapped-ready; sleep 30";
    try {
      await spawn(["bash", "-c", trapScript], { timeout: 200 });
      expect.unreachable("should have thrown");
    } catch (error) {
      expect(error).toBeInstanceOf(SpawnTimeoutError);
      const timeoutError = error as SpawnTimeoutError;
      expect(timeoutError.name).toBe("SpawnTimeoutError");
      // stdout may be empty if the pipe did not drain before SIGKILL
      expect(typeof timeoutError.stdout).toBe("string");
      expect(typeof timeoutError.stderr).toBe("string");
    }
  }, 10_000);
});
