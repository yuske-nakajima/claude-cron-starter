import { expect, test } from "bun:test";
import { runJobSafely } from "./safe-run";
import type { Job } from "./types";

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
