`templates/default/` is the assembled example workspace generated from the packaged scaffold. Optimize for a runnable standalone project that matches what the extension creates for end users.

## Rules

- Keep this workspace runnable without any repo-local Python packages.
- Treat the VS Code extension as the owner of server lifecycle, auth token generation, and schema discovery.
- Use `uv` for Python workflows under `server/`.
- Keep generated artifacts such as `server/lumen.log` and `server/lumen.schema.json` out of source edits.

## Structure

- `lumen.config.json` is the workspace home file.
- `server/` owns the self-contained Modal server used by the example workspace.
- `assets/*.lumen` are the runner config files managed from the workspace home.
- `.agents/skills/` contains optional guidance packs the extension can install into generated workspaces.

## Gotchas

- Changes here should usually mirror equivalent changes in `packages/vscode/assets/server/base/` unless the example workspace intentionally diverges from the scaffold source.
