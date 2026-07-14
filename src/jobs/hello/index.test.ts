import { expect, mock, spyOn, test } from "bun:test";

// hello ジョブが読み込まれる前に claudeQuery を差し替える必要があるため、
// mock.module を呼んでから src を動的 import する
let queryResult = "";

mock.module("../../lib/claude", () => ({
  claudeQuery: async () => queryResult,
}));

const { jobs } = await import("../");
const { run } = await import("./");

test("hello job is registered with a string schedule", () => {
  const hello = jobs.find((j) => j.name === "hello");
  expect(hello).toBeDefined();
  expect(typeof hello?.schedule).toBe("string");
});

test("hello job logs the result text when claudeQuery returns a result", async () => {
  queryResult = "hi there";
  const logSpy = spyOn(console, "log").mockImplementation(() => {});
  try {
    await run();
    expect(logSpy).toHaveBeenCalledWith("[hello] hi there");
  } finally {
    logSpy.mockRestore();
  }
});

test("hello job does not log when claudeQuery returns an empty string", async () => {
  queryResult = "";
  const logSpy = spyOn(console, "log").mockImplementation(() => {});
  try {
    await run();
    expect(logSpy).not.toHaveBeenCalled();
  } finally {
    logSpy.mockRestore();
  }
});
