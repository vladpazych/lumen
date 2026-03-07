# packages/lumen-example-modal/CLAUDE.md

Example Lumen inference server — FastAPI on Modal. Ships one stub pipeline (echo) to validate the contract without GPU.

## Rules

- Python dataclasses in `pipelines/types.py` are the contract. Mirror changes to `packages/vscode/shared/types.ts`.
- JSON responses use camelCase keys (`runId`, not `run_id`) to match the wire contract.
- `registry.py` is the only coupling point — pipelines self-register on import.
- Tests use FastAPI's `TestClient` — no Modal dependency needed for testing.

### Adding a pipeline

Each pipeline is a single file in `pipelines/` with three parts: config, generate function, registration call.

1. Define a `PipelineConfig` with `id`, `name`, `category`, `params`, `output`.
2. Define `async def generate(params: dict[str, Any]) -> GenerateResult`.
3. Call `registry.register(config, generate)` at module level.
4. Import the module in `app.py` to trigger registration.

### Generate function contract

- Receives `params: dict[str, Any]` — keys match param `name` fields.
- Returns `GenerateResult` with `status`, `run_id`, `outputs` (list of `OutputAsset`).
- `OutputAsset.url` can be a remote URL or `data:image/png;base64,...` data URL.

## Commands

```sh
uv sync              # Install Python deps
bun run dev          # modal serve (hot-reload dev server)
bun run test         # pytest
bun run lint         # ruff check
```
