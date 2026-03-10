## General

- This server is self-contained. Keep shared runtime code in `lumen_server/` and pipeline implementations in `pipelines/`.
- Export pipeline schemas as plain JSON-compatible dicts and return wire-format response dicts from `generate`.
- Let the extension manage `.authkey`, `lumen.log`, and schema snapshots.

## Structure

- `serve.py` is the Modal entrypoint used by `modal serve`.
- `lumen_server/auth.py` reads auth from `LUMEN_AUTH_TOKEN` or `.authkey`.
- `lumen_server/registry.py` discovers pipeline modules and shared secrets.
- `lumen_server/web.py` owns the FastAPI routes and auth middleware.
- `pipelines/` contains pipeline modules. Files starting with `_` are helpers only.

## Constraints

- Keep the HTTP contract stable: list pipelines, stream schema events, fetch one pipeline, generate.
- Use plain dict schemas; do not introduce custom Python schema classes or repo-local packages.
- Attach shared API keys with `serve_secrets = ["secret-name"]` when a pipeline needs them.
- Put heavyweight Modal GPU logic inside pipeline modules, not in `lumen_server/`.
