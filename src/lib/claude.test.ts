import { beforeEach, describe, expect, mock, spyOn, test } from "bun:test";

interface CapturedQueryCall {
  prompt: string;
  options: Record<string, unknown>;
}

let queryMessages: unknown[] = [];
let queryImpl: (() => void) | null = null;
let lastCall: CapturedQueryCall | undefined;

mock.module("@anthropic-ai/claude-agent-sdk", () => ({
  query: (params: CapturedQueryCall) => {
    lastCall = params;
    queryImpl?.();
    return (async function* () {
      for (const message of queryMessages) {
        yield message;
      }
    })();
  },
}));

const { claudeQuery, MODEL_MAP } = await import("./claude");

describe("claudeQuery", () => {
  beforeEach(() => {
    queryMessages = [];
    queryImpl = null;
    lastCall = undefined;
  });

  test("returns the result string on a success result", async () => {
    queryMessages = [
      { type: "result", subtype: "success", result: "hi there" },
    ];
    const result = await claudeQuery("hello", "sonnet");
    expect(result).toBe("hi there");
  });

  test("returns an empty string and warns on an error result", async () => {
    queryMessages = [{ type: "result", subtype: "error_max_turns" }];
    const warnSpy = spyOn(console, "warn").mockImplementation(() => {});
    try {
      const result = await claudeQuery("hello", "sonnet");
      expect(result).toBe("");
      expect(warnSpy).toHaveBeenCalled();
    } finally {
      warnSpy.mockRestore();
    }
  });

  test("returns an empty string and warns when query() throws", async () => {
    queryImpl = () => {
      throw new Error("network down");
    };
    const warnSpy = spyOn(console, "warn").mockImplementation(() => {});
    try {
      const result = await claudeQuery("hello", "sonnet");
      expect(result).toBe("");
      expect(warnSpy).toHaveBeenCalled();
    } finally {
      warnSpy.mockRestore();
    }
  });

  test("maps the haiku model to the SDK model id", async () => {
    queryMessages = [{ type: "result", subtype: "success", result: "ok" }];
    await claudeQuery("hello", "haiku");
    expect(lastCall?.options.model).toBe(MODEL_MAP.haiku);
  });

  test("maps the sonnet model to the SDK model id", async () => {
    queryMessages = [{ type: "result", subtype: "success", result: "ok" }];
    await claudeQuery("hello", "sonnet");
    expect(lastCall?.options.model).toBe(MODEL_MAP.sonnet);
  });

  test("maps the opus model to the SDK model id", async () => {
    queryMessages = [{ type: "result", subtype: "success", result: "ok" }];
    await claudeQuery("hello", "opus");
    expect(lastCall?.options.model).toBe(MODEL_MAP.opus);
  });

  test("defaults maxTurns to 1 when omitted", async () => {
    queryMessages = [{ type: "result", subtype: "success", result: "ok" }];
    await claudeQuery("hello", "sonnet");
    expect(lastCall?.options.maxTurns).toBe(1);
  });

  test("omits maxTurns from the options when passed null", async () => {
    queryMessages = [{ type: "result", subtype: "success", result: "ok" }];
    await claudeQuery("hello", "sonnet", null);
    expect(lastCall?.options).not.toHaveProperty("maxTurns");
  });

  test("passes a numeric maxTurns through to the SDK", async () => {
    queryMessages = [{ type: "result", subtype: "success", result: "ok" }];
    await claudeQuery("hello", "sonnet", 5);
    expect(lastCall?.options.maxTurns).toBe(5);
  });
});
