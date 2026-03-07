# packages/lumen-example-modal/CLAUDE.md

Example Lumen inference server — FastAPI on Modal. Stub pipeline (echo) validates the contract without GPU; GPU pipelines run as separate Modal classes.

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

### GPU pipelines

The `serve` function runs on a lightweight image (no torch). GPU inference runs in a separate `@app.cls` with its own image.

- Define a `gpu_image` with torch, diffusers, and model-specific deps.
- Download model weights at image build time via `.run_commands()` with `snapshot_download`. Loads once, cached across deploys.
- Use `@app.cls(image=gpu_image, gpu="A10G")` with `@modal.enter()` for model loading at container startup.
- The generate function calls `Model().method.remote(...)` — cross-function RPC within Modal.
- Keep heavy imports (`torch`, `diffusers`) inside class methods only. The serve image does not have them.
- Return image bytes from the GPU class; the generate function encodes to base64 data URL.
- Include `seed` in `OutputAsset.metadata` for reproducibility.

### `dimensions` param handling

The `dimensions` param arrives as `{"w": int, "h": int}`. Always type-check with `isinstance(dims, dict)` and provide fallback defaults.

## Commands

```sh
uv sync              # Install Python deps
bun run dev          # modal serve (hot-reload dev server)
bun run test         # pytest
bun run lint         # ruff check
```

## Gotchas

- `modal serve` hot-reload silently fails when a new `@app.cls` with an unbuilt image is added. Restart the dev server manually after adding a new GPU pipeline. Subsequent file edits hot-reload normally.
- `ruff check` line-length limit is 100 chars. Long description strings need parenthesized multi-line concatenation.
