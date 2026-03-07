# CLAUDE.md

Schema-driven image/video generation editor. Provider-agnostic `.imagic` file format, VS Code custom editor, ML inference pipelines.

## Rules

- Bun runtime for JS/TS. Never npm, pnpm, yarn, or node.
- Python via uv for ML pipelines.
- All meta commands via `./meta/run <command>`
- Commit atomically after each logical change. Follow commit nudges.
- In commit message state the problem, not the solution
- Max 72 chars. No type prefixes
- `unknown` with type guards, not `any`. Explicit null handling, not `!`.
- Comment non-obvious intent only.

## Structure

| Dir                           | Purpose                                           |
| :---------------------------- | :------------------------------------------------ |
| packages/vscode/              | VS Code custom editor extension                   |
| packages/lumen-example-modal/ | Example FastAPI + Modal inference server (Python) |
| meta/                         | Repo tooling (dexter-powered)                     |
