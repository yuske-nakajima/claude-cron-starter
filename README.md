# claude-cron-starter

English | [日本語](./README.ja.md)

A thin, copy-friendly starter for running [Claude Agent SDK](https://docs.claude.com/en/api/agent-sdk/overview) jobs headless on a cron schedule. Built on Bun + [croner](https://github.com/hexagon/croner).

> This is an unofficial community project, not affiliated with Anthropic.

## Concept

- **LLM as middleware** — leave ambiguous judgment, summarization, and classification to Claude; keep deterministic I/O in code or behind permissions.
- **Stay thin** — the core is just a croner loop that fires jobs. Each job is `index.ts` (skeleton) + `prompt.md` (instructions), with an optional colocated `index.test.ts`.
- **Idempotent one-shot jobs** — every job is safe to run any number of times.

## Requirements

- [mise](https://mise.jdx.dev/) — pins the bun version (bun 1.3.14 in `.mise.toml`).
- An environment logged in to Claude Code — the Claude Agent SDK reuses this local login (subscription auth). See [Authentication](#authentication).

## Use this template

1. Click **Use this template** → **Create a new repository** at the top right of the repository page on GitHub.
2. Create your own repository.
3. Clone it.

```sh
git clone git@github.com:<your-account>/<your-repo>.git
cd <your-repo>
```

## Setup

```sh
mise install   # install bun from .mise.toml
bun install    # install dependencies
```

## Authentication

When the `ANTHROPIC_API_KEY` environment variable is empty, the Claude Agent SDK reuses the Claude Code local login (subscription auth). `.mise.toml` sets `ANTHROPIC_API_KEY` to empty as below, preventing a switch to metered API-key billing from a key left in your shell.

```toml
[env]
ANTHROPIC_API_KEY = ""
```

So you do not need a separate API key. It works as long as you are logged in to Claude Code.

## Running

```sh
bun run start   # start (no file watching)
bun run watch   # long-running with restart on file changes
```

Both commands keep the croner loop running and do not exit on their own; the difference is only whether files are watched. If you use tmux, run either inside a session to keep the process alive across detach/logout.

```sh
tmux new -s cron       # create a session
bun run watch          # start the long-running process
# detach: Ctrl-b d
tmux attach -t cron    # reattach
```

Schedules are evaluated in the `Asia/Tokyo` timezone (`src/cron.ts`).

## Adding a job

1. Create `src/jobs/<name>/` with `index.ts` and `prompt.md`.
2. In `index.ts`, export `schedule` (cron 5-field syntax) and `run()`.
3. Register it in the `jobs` array in `src/jobs/index.ts`.
4. Optionally colocate a test as `src/jobs/<name>/index.test.ts` — `bun test` picks up `*.test.ts` anywhere (see `src/jobs/hello/index.test.ts`).

Skeleton for `src/jobs/<name>/index.ts`:

```ts
import { readFile } from "node:fs/promises";
import { query } from "@anthropic-ai/claude-agent-sdk";

export const schedule = "0 9 * * *"; // e.g. daily at 9:00

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

Register it in `src/jobs/index.ts`:

```ts
import type { Job } from "../types";
import * as myjob from "./<name>";

export const jobs: Job[] = [
  { name: "<name>", schedule: myjob.schedule, run: myjob.run },
];
```

## The hello sample job

`src/jobs/hello/` fires every minute (`* * * * *`) and passes `prompt.md` to Claude to return a short greeting that includes the current date/time in Asia/Tokyo. It is a sanity-check sample, so once you start using the template, replace it with your own job or delete it.

## Development commands

```sh
bun run typecheck   # type check with tsc
bun run lint        # check with biome
bun run fmt         # format with biome
bun run test        # bun test
```

CI (typecheck / lint / test) runs on push to main and on pull requests. A dependency-check CI runs every Monday at 9:00 JST.

## License

MIT
