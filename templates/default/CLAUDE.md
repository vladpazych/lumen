# CLAUDE.md

Lumen project — image/video generation with `.lumen` files and a pipeline server on Modal.

## Structure

| Path                               | Purpose                                            |
| :--------------------------------- | :------------------------------------------------- |
| lumen-server/                      | FastAPI inference server deployed on Modal         |
| lumen-server/pipelines/            | Pipeline modules (auto-discovered)                 |
| lumen-server/CLAUDE.md             | Server docs: adding pipelines, Modal patterns      |
| lumen-server/lumen.schema.json     | Generated pipeline schema (gitignored)             |
| lumen-server/lumen.log             | Server log output (gitignored)                     |
| \*.lumen                           | Generation config files (opened in VS Code)        |
| .claude/skills/lumen-file/SKILL.md | How to author `.lumen` files — read before editing |

## Rules

- Python via uv for the server. Never pip install directly.
- `unknown` with type guards, not `any`. Explicit null handling, not `!`.
- Comment non-obvious intent only.
- To create or edit `.lumen` files, follow `.claude/skills/lumen-file/SKILL.md`.

## Workflow

1. Write pipelines in `lumen-server/pipelines/` — see `lumen-server/CLAUDE.md`
2. Create `.lumen` files to configure generation params (see `.claude/skills/lumen-file/SKILL.md`)
3. The VS Code extension manages the dev server and renders `.lumen` files
4. Check `lumen-server/lumen.log` for server output and errors

## Quick reference

```sh
cd lumen-server
uv run modal serve app.py    # start dev server (extension does this)
uv run pytest tests/         # validate pipeline contracts
uv run ruff check .          # lint
```

## Prerequisites

Run `bash doctor.sh` to check: Python 3.12+, uv, Modal CLI, VS Code.
