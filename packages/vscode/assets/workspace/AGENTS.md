`/` is a Lumen workspace root: workspace home, committed Modal server, gitignored runner configs, and optional agent skills. Optimize for a runnable project that non-devs can steer from VS Code and agents can edit safely.

## Rules

- Keep `server/` committed. Keep `assets/` gitignored for `.lumen` files and generated outputs.
- Treat the VS Code extension as the owner of server lifecycle, auth token generation, and schema discovery.
- Use `uv` for Python workflows under `server/`.
- Keep generated runtime artifacts such as `server/.authkey`, `server/lumen.log`, and `server/lumen.schema.json` out of source edits.
- Keep durable workspace guidance here and deeper runtime-only guidance in `server/AGENTS.md`.

## Structure

- `lumen.config.json` is the workspace home file.
- `server/` owns the self-contained Modal server and discoverable pipelines.
- `assets/*.lumen` are the runner config files managed from the workspace home.
- `.agents/skills/` and `.claude/skills/` contain optional guidance packs installed by Lumen.

## Gotchas

- Changes to the committed workspace server should usually mirror equivalent changes in `packages/vscode/assets/server/base/` unless this workspace intentionally diverges from the scaffold.
