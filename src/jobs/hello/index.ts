import { readFile } from "node:fs/promises";
import { query } from "@anthropic-ai/claude-agent-sdk";

// 毎分発火（サンプル）。実運用ではジョブごとに調整する
export const schedule = "* * * * *";

const promptPath = new URL("./prompt.md", import.meta.url);

export async function run(): Promise<void> {
  const prompt = await readFile(promptPath, "utf8");

  for await (const message of query({ prompt, options: { maxTurns: 1 } })) {
    if (message.type !== "result") {
      continue;
    }
    if (message.subtype === "success") {
      console.log(`[hello] ${message.result}`);
    } else {
      // error_max_turns / error_during_execution 等の失敗 result を可観測にする
      console.error(`[hello] result failed: ${message.subtype}`);
    }
  }
}
