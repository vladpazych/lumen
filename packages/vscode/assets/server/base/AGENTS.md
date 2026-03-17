`packages/vscode/assets/server/base/` is the scaffold source shipped inside the extension for generated workspaces. Optimize for a self-contained Modal server that the extension can start and inspect without repo-local dependencies.

## Rules

- Use `uv` for Python workflows in this subtree.
- Keep the scaffold self-contained. Do not introduce dependencies on repo-local Python packages.
- Keep pipeline `config` values and `generate()` results plain JSON-shaped data.
- Read secrets from environment variables or Modal secrets. Never hardcode credentials.
- Keep extension-managed artifacts such as `.authkey`, logs, and schema snapshots out of source control logic.

## Structure

- `serve.py` is the Modal entrypoint used by the extension-managed dev server flow.
- `lumen_server/` owns auth, registry, Modal app wiring, and FastAPI routes.
- `pipelines/` owns pipeline implementations and helper modules for discovery.
- `tests/` owns API contract coverage for the scaffold server.

## Verification

- Run `uv run ruff check .` from this directory after Python edits.
- Run `uv run pytest` from this directory after server or pipeline edits.

## Gotchas

- Files in `pipelines/` that start with `_` are helpers, not discoverable pipelines.
- Keep the HTTP contract stable for pipeline listing, pipeline lookup, and generation requests because the extension depends on it directly.
