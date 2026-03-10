## General

- This directory is an assembled example project generated from the extension-packaged scaffold assets.
- Keep the project runnable without any repo-local Python packages.
- Treat the VS Code extension as the owner of server lifecycle, auth token generation, and schema discovery.

## Structure

- `server/` is the self-contained Modal server.
- `server/pipelines/` contains installed example pipeline packs.
- `*.lumen` files point at the live URL detected by the extension.
- `.agents/skills/` contains optional AI guidance packs the extension can install into real workspaces.

## Constraints

- Use `uv` for Python workflows in `server/`.
- Keep `server/lumen.log` and `server/lumen.schema.json` as generated artifacts, not source files.
- Do not add dependencies on repo-local Python modules.
