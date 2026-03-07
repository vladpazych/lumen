# packages/lumen-example-modal/CLAUDE.md

Lumen inference server template — FastAPI on Modal. Pipelines are auto-discovered from `pipelines/` directory.

## Adding a pipeline

Create a single file in `pipelines/` that exports two things:

1. `config` — a `PipelineConfig` defining the schema (id, name, params, output)
2. `generate` — an `async def generate(params: dict[str, Any]) -> GenerateResult`

That's it. No imports in `app.py`, no registration calls. The server auto-discovers all pipeline modules on startup. Copy `pipelines/_template.py` as a starting point.

### Available param types

| Type              | Key fields                                                             | Renders as                  |
| :---------------- | :--------------------------------------------------------------------- | :-------------------------- |
| `PromptParam`     | `default`                                                              | Textarea                    |
| `TextParam`       | `default`, `multiline`                                                 | Input or textarea           |
| `NumberParam`     | `default`, `min`, `max`, `step`                                        | Number input (float)        |
| `IntegerParam`    | `default`, `min`, `max`                                                | Number input (int)          |
| `BooleanParam`    | `default`                                                              | Checkbox                    |
| `SelectParam`     | `options: [SelectOption(value, label)]`, `default`                     | Dropdown                    |
| `SeedParam`       | `default`                                                              | Number + randomize button   |
| `DimensionsParam` | `default: Dimensions(w, h)`, `presets: [DimensionPreset(w, h, label)]` | W×H inputs + preset buttons |
| `ImageParam`      | —                                                                      | File upload + drag-drop     |
| `VideoParam`      | —                                                                      | File upload (limited UI)    |

All param types share: `name` (required, key in params dict), `label`, `required`, `group`.

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

## What NOT to modify

- `app.py` — auto-discovers pipelines, no changes needed
- `pipelines/types.py` — Pydantic models shared with the VS Code client
- `pipelines/registry.py` — framework code
- `pipelines/__init__.py` — Modal app definition
- `tests/test_api.py` — contract tests (validates all pipelines automatically)

## Rules

- Types are Pydantic models in `pipelines/types.py`. Do not add new param types without also updating `packages/lumen/types/schema.ts`.
- JSON responses use camelCase `runId` (not `run_id`) — handled by `GenerateResult.to_wire()`.
- Pipeline `id` must be a unique kebab-case slug.
- Files starting with `_` are skipped by discovery.

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
