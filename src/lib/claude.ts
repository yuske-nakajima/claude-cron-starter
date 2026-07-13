import { query } from "@anthropic-ai/claude-agent-sdk";

/** ジョブから指定できる短縮モデル名。 */
export type ClaudeModel = "haiku" | "sonnet" | "opus";

/** 短縮モデル名から SDK に渡すモデル ID へのマッピング。 */
export const MODEL_MAP: Record<ClaudeModel, string> = {
  haiku: "claude-haiku-4.5-20251001",
  sonnet: "claude-sonnet-5",
  opus: "claude-opus-4-8",
};

const DEFAULT_MAX_TURNS = 1;

/**
 * Claude Agent SDK の `query()` をラップし、単一の結果文字列を返す共通クエリ関数。
 *
 * `maxTurns` を省略した場合は 1 が渡され、`null` を渡すと SDK のデフォルト制御に委譲する。
 * 失敗した result や `query()` の例外は握りつぶし、`console.warn` でログを出したうえで空文字列を返す。
 *
 * @param prompt - Claude に送るプロンプト文字列
 * @param model - 使用する短縮モデル名 (`haiku` / `sonnet` / `opus`)
 * @param maxTurns - 最大ターン数。省略時は 1、`null` で SDK デフォルトに委譲
 * @returns 成功時は `result` の文字列、失敗時は空文字列
 */
export async function claudeQuery(
  prompt: string,
  model: ClaudeModel,
  maxTurns?: number | null,
): Promise<string> {
  const options: { model: string; maxTurns?: number } = {
    model: MODEL_MAP[model],
  };
  if (maxTurns === undefined) {
    options.maxTurns = DEFAULT_MAX_TURNS;
  } else if (maxTurns !== null) {
    options.maxTurns = maxTurns;
  }

  try {
    for await (const message of query({ prompt, options })) {
      if (message.type !== "result") continue;
      if (message.subtype === "success") {
        return message.result;
      }
      console.warn(`[claudeQuery] result failed: ${message.subtype}`);
      return "";
    }
    return "";
  } catch (error) {
    console.warn("[claudeQuery] query() threw:", error);
    return "";
  }
}
