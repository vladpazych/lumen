# Lumen Modal Server

Self-contained Modal pipeline server scaffold. Pipelines live in `pipelines/` and are auto-discovered at startup.

## Rules

- Python via `uv`. Never `pip install` directly.
- Keep the server self-contained. Do not introduce a repo-local SDK dependency.
- `config` is plain JSON-shaped data. `generate()` returns plain JSON-shaped results.
- Read API keys from environment variables or Modal secrets. Never hardcode secrets.

## Adding a pipeline

Create a file in `pipelines/` that exports:

1. `config` — a plain dict matching the Lumen pipeline schema
2. `generate(params)` — async function returning a plain dict response

Optional:

- `serve_secrets = ["secret-name"]` to attach Modal secrets to the shared serve container

Copy `pipelines/_template.py` to start.
