`templates/default/` is a Lumen workspace root: workspace home, committed Modal server, gitignored runner configs, and optional agent skills. Optimize for a runnable project that non-devs can steer from VS Code and agents can edit safely.

## Rules

- Keep `server/` committed. Keep `assets/` gitignored for `.lumen` files and generated outputs.
- Treat the VS Code extension as the owner of server lifecycle, auth token generation, and schema discovery.
- Use `uv` for Python workflows under `server/`.
- Keep generated runtime artifacts such as `server/.authkey`, `server/lumen.log`, and `server/lumen.schema.json` out of source edits.
- Keep the server HTTP contract stable for pipeline listing, pipeline lookup, and generation requests because the extension depends on it directly.
- Keep pipeline `config` values and `generate()` results plain JSON-shaped data.

## Structure

- `lumen.config.json` is the workspace home file.
- `server/` owns the self-contained Modal server and discoverable pipelines.
- `server/lumen_server/` owns auth, registry, Modal app wiring, and FastAPI routes.
- `server/pipelines/` owns discoverable pipeline modules and helpers. Files starting with `_` are helpers only.
- `assets/*.lumen` are the runner config files managed from the workspace home.
- `.agents/skills/` and `.claude/skills/` contain optional guidance packs installed by Lumen.

## Gotchas

- Changes here should usually mirror equivalent changes in `packages/vscode/assets/server/base/` unless the example workspace intentionally diverges from the scaffold source.
