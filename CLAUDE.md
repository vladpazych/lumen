# CLAUDE.md

Schema-driven image/video generation editor. Provider-agnostic `.lumen` file format, VS Code custom editor, ML inference pipelines.

## Rules

- Bun runtime for JS/TS. Never npm, pnpm, yarn, or node.
- Python via uv for ML pipelines.
- All meta commands via `./meta/run <command>`
- Commit atomically after each logical change. Follow commit nudges.
- In commit message state the problem, not the solution
- Max 72 chars. No type prefixes
- `unknown` with type guards, not `any`. Explicit null handling, not `!`.
- Comment non-obvious intent only.

### Commits

- Commit atomically after each logical change. Follow commit nudges (`./meta/run commit "message" file1 file2 ...`).
- In message state the problem, not the solution — `"Purpose line misrepresented repo"`, not `"Update purpose line"`
- For trivial changes – short imperative "what" — `"Fix typo in README"`
- Max 72 chars. No type prefixes
- Quality gates (format, lint, typecheck) run automatically
- `git revert` for undo. Never reset, amend, or force-push

## Structure

| Dir                 | Purpose                                         |
| :------------------ | :---------------------------------------------- |
| packages/lumen/     | Hexagonal core: types, ports, domain, services  |
| packages/vscode/    | VS Code custom editor extension                 |
| packages/lumen-sdk/ | Pipeline server framework (Python, pip package) |
| templates/default/  | Example project with server and pipelines       |
| meta/               | Repo tooling (dexter-powered)                   |

## Gotchas

- Emergency brake: `touch .claude/hooks-disabled`. Remove immediately after fix.
