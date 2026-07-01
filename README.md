# claude-cron-starter

English | [日本語](./README.ja.md)

A thin, copy-friendly starter for running [Claude Agent SDK](https://docs.claude.com/en/api/agent-sdk/overview) jobs headless on a cron schedule. Built on Bun + [croner](https://github.com/hexagon/croner).

> This is an unofficial community project, not affiliated with Anthropic.

## Concept

- **LLM as middleware** — leave ambiguous judgment, summarization, and classification to Claude; keep deterministic I/O in code or behind permissions.
- **Stay thin** — the core is just a croner loop that fires jobs. Each job is `index.ts` (skeleton) + `prompt.md` (instructions).
- **Idempotent one-shot jobs** — every job is safe to run any number of times.

## Status

Work in progress. Implementation is not started yet.

## License

MIT
