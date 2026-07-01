import { expect, mock, spyOn, test } from "bun:test";

// hello ジョブが読み込まれる前に SDK の query を差し替える必要があるため、
// mock.module を呼んでから src を動的 import する
let queryMessages: unknown[] = [];

mock.module("@anthropic-ai/claude-agent-sdk", () => ({
  query: () =>
    (async function* () {
      for (const message of queryMessages) {
        yield message;
      }
    })(),
}));

const { jobs } = await import("../src/jobs");
const { run } = await import("../src/jobs/hello");

test("hello job is registered with a string schedule", () => {
  const hello = jobs.find((j) => j.name === "hello");
  expect(hello).toBeDefined();
  expect(typeof hello?.schedule).toBe("string");
});

test("hello job logs the result text on a success result", async () => {
  queryMessages = [{ type: "result", subtype: "success", result: "hi there" }];
  const logSpy = spyOn(console, "log").mockImplementation(() => {});
  try {
    await run();
    expect(logSpy).toHaveBeenCalledWith("[hello] hi there");
  } finally {
    logSpy.mockRestore();
  }
});

test("hello job logs an error on a failure result", async () => {
  queryMessages = [{ type: "result", subtype: "error_max_turns" }];
  const errorSpy = spyOn(console, "error").mockImplementation(() => {});
  try {
    await run();
    expect(errorSpy).toHaveBeenCalledWith(
      "[hello] result failed: error_max_turns",
    );
  } finally {
    errorSpy.mockRestore();
  }
});
