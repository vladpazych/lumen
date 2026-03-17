Lumen is a schema-driven editor stack: framework-free `.lumen` core, VS Code editor, and scaffolded inference server assets. Optimize for clear package boundaries and reproducible repo tooling.

## Rules

- Use Bun for JS and TS work. Do not use npm, pnpm, yarn, or raw `node`.
- Use `uv` for Python work in server subtrees. Do not use `pip` directly.
- Run repo-level tooling through `dexter` when the repo provides a matching command.
- Commit each logical change atomically and follow commit nudges.
- Commit messages state the problem, stay within 72 characters, and use no type prefix.
- Use `git revert` for undo. Do not reset, amend, or force-push.
- Prefer `unknown` with type guards over `any`.
- Handle nullable values explicitly. Do not rely on non-null assertions.
- Comment only non-obvious intent.
- Keep durable working constraints in `AGENTS.md`, workflows in skills, and human explanation in `README.md`.

## Structure

- `packages/lumen/` owns the framework-free core: types, port contracts, domain logic, and service factories.
- `packages/vscode/` owns the VS Code extension, adapters, webview, and scaffold assets shipped with the extension.
- `templates/default/` owns the assembled example workspace generated from the packaged scaffold.
- `meta/` owns repo tooling packages such as shared config and Dexter commands.

## Verification

- Run `bun run lint` for repo-wide JS or TS edits.
- Run the narrowest verification command from the touched subtree before finishing a change.

## Gotchas

- `touch .codex/hooks-disabled` disables repo hooks as an emergency brake. Remove the file immediately after the fix.
