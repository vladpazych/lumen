`templates/default/server/` is the generated workspace's self-contained Modal server. Optimize for a stable HTTP contract and clear separation between shared runtime code and pipeline implementations.

## Rules

- Keep shared runtime code in `lumen_server/` and pipeline-specific logic in `pipelines/`.
- Keep pipeline schemas and generation responses as plain JSON-compatible dicts.
- Keep the HTTP contract stable for listing pipelines, fetching one pipeline, and running generation.
- Use `serve_secrets = ["secret-name"]` when a pipeline needs shared Modal secrets.
- Let the extension manage `.authkey`, logs, and schema snapshots.
- Do not introduce repo-local Python packages or custom schema frameworks.

## Structure

- `serve.py` is the Modal entrypoint.
- `lumen_server/auth.py` reads auth from `LUMEN_AUTH_TOKEN` or `.authkey`.
- `lumen_server/registry.py` discovers pipelines and shared secrets.
- `lumen_server/web.py` owns FastAPI routes and auth middleware.
- `pipelines/` owns discoverable pipeline modules. Files starting with `_` are helpers only.
- `tests/` owns HTTP contract coverage for the generated server.

## Verification

- Run `uv run ruff check .` from this directory after Python edits.
- Run `uv run pytest` from this directory after server or pipeline edits.

## Gotchas

- Put heavyweight Modal GPU logic inside pipeline modules, not in `lumen_server/`.
