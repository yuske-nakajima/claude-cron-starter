# claude-cron-starter

[English](./README.md) | 日本語

[Claude Agent SDK](https://docs.claude.com/en/api/agent-sdk/overview) のジョブを cron スケジュールでヘッドレス実行するための、薄いコピペ前提のスターター。Bun + [croner](https://github.com/hexagon/croner) で構成する。

> Anthropic 非公式のコミュニティプロジェクトです。

## コンセプト

- **LLM は middleware** — 曖昧な判断・要約・分類だけ Claude に任せ、決定的な I/O はコード側または権限で締める。
- **薄く保つ** — コアはジョブを発火する croner ループのみ。各ジョブは `index.ts`（骨格）+ `prompt.md`（指示）の 2 枚構成（テストを書く場合は `index.test.ts` を同居させる）。
- **冪等 one-shot ジョブ** — 各ジョブは何回叩いても同じ結果になるよう設計する。

## 前提条件

- [mise](https://mise.jdx.dev/) — bun のバージョンを固定する（`.mise.toml` で bun 1.3.14）。
- Claude Code にログイン済みの環境 — Claude Agent SDK はこのローカルログイン（サブスク認証）を流用する。詳細は [認証の仕組み](#認証の仕組み) を参照。

## Use this template

1. GitHub のリポジトリページ右上の **Use this template** → **Create a new repository** をクリックする。
2. 自分のリポジトリを作成する。
3. clone する。

```sh
git clone git@github.com:<your-account>/<your-repo>.git
cd <your-repo>
```

## セットアップ

```sh
mise install   # .mise.toml の bun を導入
bun install    # 依存を導入
```

## 認証の仕組み

Claude Agent SDK は環境変数 `ANTHROPIC_API_KEY` が空のとき、Claude Code のローカルログイン（サブスク認証）を流用する。`.mise.toml` は以下のように `ANTHROPIC_API_KEY` を空に設定し、シェルに残った API キーによる従量課金への切り替わりを防ぐ。

```toml
[env]
ANTHROPIC_API_KEY = ""
```

このため、API キーを別途用意する必要はない。Claude Code にログイン済みであれば動作する。

## 動かし方

```sh
bun run start   # 起動（ファイル監視なし）
bun run watch   # ファイル変更で再起動する監視付き常駐
```

どちらのコマンドも croner ループが常駐し、自然終了しない（差はファイル変更を監視するかどうかのみ）。tmux を使う場合は、どちらもセッション内で起動すればデタッチ/ログアウト後もプロセスが保持される。

```sh
tmux new -s cron       # セッションを作成
bun run watch          # 常駐起動
# デタッチ: Ctrl-b d
tmux attach -t cron    # 再アタッチ
```

スケジュールはタイムゾーン `Asia/Tokyo` で評価される（`src/cron.ts`）。

## ジョブの追加

1. `src/jobs/<name>/` を作り、`index.ts` と `prompt.md` を置く。
2. `index.ts` で `schedule`（cron 5 フィールド記法）と `run()` を export する。
3. `src/jobs/index.ts` の `jobs` 配列に登録する。
4. テストを書く場合は `src/jobs/<name>/index.test.ts` として同ディレクトリに置く。`bun test` は場所を問わず `*.test.ts` を拾う（例: `src/jobs/hello/index.test.ts`）。

`src/jobs/<name>/index.ts` の骨格:

```ts
import { readFile } from "node:fs/promises";
import { query } from "@anthropic-ai/claude-agent-sdk";

export const schedule = "0 9 * * *"; // 例: 毎日 9:00

const promptPath = new URL("./prompt.md", import.meta.url);

export async function run(): Promise<void> {
  const prompt = await readFile(promptPath, "utf8");
  for await (const message of query({ prompt, options: { maxTurns: 1 } })) {
    if (message.type !== "result") continue;
    if (message.subtype === "success") {
      console.log(`[<name>] ${message.result}`);
    } else {
      console.error(`[<name>] result failed: ${message.subtype}`);
    }
  }
}
```

`src/jobs/index.ts` へ登録:

```ts
import type { Job } from "../types";
import * as myjob from "./<name>";

export const jobs: Job[] = [
  { name: "<name>", schedule: myjob.schedule, run: myjob.run },
];
```

## hello サンプルジョブ

`src/jobs/hello/` は毎分（`* * * * *`）発火し、`prompt.md` を Claude に渡して Asia/Tokyo の日時を含む短い挨拶を返すサンプル。動作確認用なので、テンプレートを使い始めたら自分のジョブに置き換えるか削除する。

## 開発コマンド

```sh
bun run typecheck   # tsc による型チェック
bun run lint        # biome によるチェック
bun run fmt         # biome によるフォーマット
bun run test        # bun test
```

main への push と PR で CI（typecheck / lint / test）が走る。依存チェックの CI が毎週月曜 9:00 JST に走る。

## ライセンス

MIT
