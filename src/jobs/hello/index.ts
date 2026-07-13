import { readFile } from "node:fs/promises";
import { claudeQuery } from "../../lib/claude";

// 毎分発火（サンプル）。実運用ではジョブごとに調整する
export const schedule = "* * * * *";

const promptPath = new URL("./prompt.md", import.meta.url);

export async function run(): Promise<void> {
  const prompt = await readFile(promptPath, "utf8");
  const result = await claudeQuery(prompt, "sonnet");
  if (result) {
    console.log(`[hello] ${result}`);
  }
}
