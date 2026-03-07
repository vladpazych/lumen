# CLAUDE.md

Lumen project — image/video generation with `.lumen` files and a pipeline server on Modal.

## Structure

| Dir           | Purpose                                    |
| :------------ | :----------------------------------------- |
| lumen-server/ | FastAPI inference server deployed on Modal |
| \*.lumen      | Generation config files (opened in editor) |

## Rules

- Python via uv for the server. Never pip install directly.
- `unknown` with type guards, not `any`. Explicit null handling, not `!`.
- Comment non-obvious intent only.

## Workflow

1. Write pipelines in `lumen-server/pipelines/` — see `lumen-server/CLAUDE.md`
2. Create `.lumen` files to configure generation params
3. The VS Code extension manages the dev server and renders `.lumen` files

## Quick reference

```sh
cd lumen-server
uv run modal serve app.py    # start dev server (extension does this)
uv run pytest tests/         # validate pipeline contracts
uv run ruff check .          # lint
```

## Prerequisites

Run `bash doctor.sh` to check: Python 3.12+, uv, Modal CLI, VS Code.
