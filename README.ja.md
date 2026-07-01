# claude-cron-starter

[English](./README.md) | 日本語

[Claude Agent SDK](https://docs.claude.com/en/api/agent-sdk/overview) のジョブを cron スケジュールでヘッドレス実行するための、薄いコピペ前提のスターター。Bun + [croner](https://github.com/hexagon/croner) で構成する。

> Anthropic 非公式のコミュニティプロジェクトです。

## コンセプト

- **LLM は middleware** — 曖昧な判断・要約・分類だけ Claude に任せ、決定的な I/O はコード側または権限で締める。
- **薄く保つ** — コアはジョブを発火する croner ループのみ。各ジョブは `index.ts`（骨格）+ `prompt.md`（指示）の 2 枚構成。
- **冪等 one-shot ジョブ** — 各ジョブは何回叩いても同じ結果になるよう設計する。

## ステータス

実装はこれから。

## ライセンス

MIT
