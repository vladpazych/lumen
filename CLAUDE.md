# CLAUDE.md

Schema-driven image editor (extracted from imagic).

## Rules

- Bun runtime. Never npm, pnpm, yarn, or node.
- All meta commands via `./meta/run <command>`
- Commit atomically after each logical change. Follow commit nudges.
- In commit message state the problem, not the solution
- Max 72 chars. No type prefixes
- `unknown` with type guards, not `any`. Explicit null handling, not `!`.
- Comment non-obvious intent only.

## Structure

| Dir | Purpose |
|:----|:--------|
| packages/lumen/ | Core library |
| meta/ | Repo tooling (dexter-powered) |
