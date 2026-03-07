# lumen-server/CLAUDE.md

Lumen inference server — FastAPI on Modal. Pipelines are auto-discovered from `pipelines/` directory.

## Adding a pipeline

Create a single file in `pipelines/` that exports two things:

1. `config` — a `PipelineConfig` defining the schema (id, name, params, output)
2. `generate` — an `async def generate(params: dict[str, Any]) -> GenerateResult`

No imports in `app.py`, no registration calls. The server auto-discovers all pipeline modules on startup. Copy `pipelines/_template.py` as a starting point.

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

## Modal patterns

This server runs on [Modal](https://modal.com) — a serverless cloud platform. The Modal app is defined in `pipelines/__init__.py`.

### Images — define deps per function, not globally

Each `@app.function` or `@app.cls` gets its own container image. Define dependencies in the Image, not in `pyproject.toml`. Put `import` statements inside class methods — module-level code must be executable in all images.

```python
gpu_image = (
    modal.Image.debian_slim(python_version="3.12")
    .pip_install("torch>=2.4.0", "diffusers>=0.32.0")  # deps go here
    .apt_install("ffmpeg")                               # system packages
    .run_commands("python -c 'from huggingface_hub import snapshot_download; "
                  "snapshot_download(\"model/id\")'")    # cache weights at build
)
```

### Classes — stateful GPU containers

Use `@app.cls` for models that need warm containers with loaded weights:

```python
@app.cls(image=gpu_image, gpu="A10G", timeout=120)
class MyModel:
    @modal.enter()
    def load(self):
        import torch  # heavy import inside method
        self.model = ...

    @modal.method()
    def inference(self, prompt: str) -> bytes:
        ...
```

Invoke from the generate function: `MyModel().inference.remote(prompt)`.

### GPU options

```python
gpu="T4"           # Budget, 16 GB VRAM
gpu="A10G"         # Mid-range, 24 GB VRAM
gpu="A100"         # High-end, 40/80 GB VRAM
gpu="H100"         # Top-end
gpu="A100:2"       # Multi-GPU
gpu=["H100", "A100", "any"]  # Fallback chain
```

### Secrets — API keys and credentials

Modal secrets have two independent names: the **secret name** (what you pass to `from_name()`) and the **environment variable name(s)** stored inside it (what you read from `os.environ`). These are configured separately in the Modal dashboard.

```python
@app.cls(image=gpu_image, gpu="A10G", secrets=[modal.Secret.from_name("replicate-api-key")])
class MyModel:
    @modal.enter()
    def load(self):
        import os
        self.api_key = os.environ["REPLICATE_API_TOKEN"]
```

Setup: Modal dashboard > Secrets > Create new secret > name it (kebab-case) > add env vars.

### Style rules

- Always `import modal` then use qualified names: `modal.Image`, `modal.enter()`.
- Names use kebab-case: `modal.App("lumen")`.
- Never use deprecated Modal features.

### `dimensions` param handling

The `dimensions` param arrives as `{"w": int, "h": int}`. Always type-check with `isinstance(dims, dict)` and provide fallback defaults.

## Auth

The server requires a Bearer token on every request. The VS Code extension generates the key at `.authkey` (gitignored) before starting `modal serve`. The server reads this file — it never generates the key itself.

- Pipeline authors do not need to think about auth — middleware handles it.
- Tests import the key from `app.py` and include it in the test client.

## What NOT to modify

- `app.py` — auto-discovers pipelines, no changes needed
- `pipelines/_types.py` — Pydantic models shared with the VS Code client
- `pipelines/_registry.py` — framework code
- `pipelines/__init__.py` — Modal app + re-exports
- `tests/test_api.py` — contract tests (validates all pipelines automatically)

## Rules

- Types are Pydantic models in `pipelines/_types.py`, re-exported from `pipelines`. Import as `from pipelines import PipelineConfig, ...`.
- JSON responses use camelCase `runId` (not `run_id`) — handled by `GenerateResult.to_wire()`.
- Pipeline `id` must be a unique kebab-case slug.
- Files starting with `_` are skipped by discovery.

## Workflow

The VS Code extension manages the dev server (`modal serve`) and hot-reloads automatically. You do NOT run the server yourself — just write code and validate.

```sh
uv run pytest tests/         # validate schema + contract compliance
uv run ruff check .          # lint
```

After saving a pipeline file, the extension hot-reloads the server. Check `lumen.log` in this directory for server output and errors.

## Gotchas

- Hot-reload silently fails when a new `@app.cls` with an unbuilt image is added. Restart the dev server from VS Code after adding a new GPU pipeline. Subsequent file edits hot-reload normally.
- `ruff check` line-length limit is 100 chars. Long description strings need parenthesized multi-line concatenation.
- Server logs go to `lumen.log` in this directory — read this file to diagnose runtime errors.
