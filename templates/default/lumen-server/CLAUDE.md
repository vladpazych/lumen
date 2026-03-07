# packages/lumen-example-modal/CLAUDE.md

Lumen inference server template — FastAPI on Modal. Pipelines are auto-discovered from `pipelines/` directory.

## Adding a pipeline

Create a single file in `pipelines/` that exports two things:

1. `config` — a `PipelineConfig` defining the schema (id, name, params, output)
2. `generate` — an `async def generate(params: dict[str, Any]) -> GenerateResult`

That's it. No imports in `app.py`, no registration calls. The server auto-discovers all pipeline modules on startup. Copy `pipelines/_template.py` as a starting point.

### Available param types

| Type              | Key fields                                                             | Renders as                           |
| :---------------- | :--------------------------------------------------------------------- | :----------------------------------- |
| `PromptParam`     | `default`                                                              | Textarea                             |
| `TextParam`       | `default`, `multiline`                                                 | Input or textarea                    |
| `NumberParam`     | `default`, `min`, `max`, `step`, `display`                             | Number input or slider               |
| `IntegerParam`    | `default`, `min`, `max`, `display`                                     | Integer input or slider              |
| `BooleanParam`    | `default`                                                              | Checkbox                             |
| `SelectParam`     | `options`, `default`, `allowCustom`, `display`                         | Dropdown, combobox, radio, or toggle |
| `SeedParam`       | `default`                                                              | Number + randomize button            |
| `DimensionsParam` | `default: Dimensions(w, h)`, `presets: [DimensionPreset(w, h, label)]` | W×H inputs + preset buttons          |
| `ImageParam`      | `maxItems`                                                             | File upload + drag-drop              |
| `VideoParam`      | `maxItems`                                                             | File upload + drag-drop              |
| `TagsParam`       | `options`, `default`, `allowCustom`, `max`                             | Chip list + input                    |

All param types share: `name` (required, key in params dict), `label`, `required`, `group`, `placeholder`, `hint`, `hidden`.

### Display hints

Some param types accept a `display` field to control UI rendering:

- **SelectParam** `display`: `"dropdown"` (default), `"radio"` (2-5 options), `"toggle"` (2-4 compact options). With `allowCustom=True`, dropdown becomes a combobox allowing freeform input.
- **NumberParam / IntegerParam** `display`: `"input"` (default), `"slider"` (requires `min` and `max`).

### Common fields

- `placeholder` — ghost text inside empty inputs (disappears on focus)
- `hint` — helper text shown below the field (always visible, explains what the param does)
- `hidden` — param sent in generate but not shown in UI (for fixed pipeline constants)

### Client-side validation

The client validates params against the schema before sending. These constraints are enforced automatically:

- `required` — blocks Generate if empty
- `min` / `max` on `NumberParam` / `IntegerParam` — range check
- `IntegerParam` — must be a whole number
- `TagsParam` `max` — limits tag count
- `SelectParam` without `allowCustom` — value must be in `options`

Set constraints in the schema — the client handles the rest. Errors show inline below the field and disable the Generate button.

### Writing user-friendly schemas

Group related params, set sensible defaults, and use hints to teach:

```python
config = PipelineConfig(
    id="my-pipeline",
    name="My Pipeline",
    category="image",
    params=[
        PromptParam(
            name="prompt", label="Prompt",
            required=True,
            placeholder="A photo of...",
            group="basic",
        ),
        NumberParam(
            name="strength", label="Strength",
            default=0.7, min=0, max=1, step=0.05,
            display="slider",
            hint="Lower values preserve more of the original",
            group="basic",
        ),
        IntegerParam(
            name="steps", label="Steps",
            default=30, min=1, max=100,
            display="slider",
            hint="More steps = higher quality, slower",
            group="advanced",
        ),
        SelectParam(
            name="style", label="Style",
            options=[
                SelectOption(value="photo", label="Photo"),
                SelectOption(value="anime", label="Anime"),
            ],
            display="toggle",
            group="basic",
        ),
    ],
    output=PipelineOutput(type="image"),
)
```

**Guidelines:**

- Always set `default` — empty fields confuse users
- Always set `min`/`max` on numbers — enables slider display and client validation
- Use `group` to separate "basic" from "advanced" params
- Use `hint` for non-obvious params — one line explaining the effect
- Use `placeholder` for format hints ("e.g. 512" or "A photo of...")
- Use `required=True` only for params that truly cannot be omitted (usually just prompt)

### Generate function contract

- Receives `params: dict[str, Any]` — keys match param `name` fields.
- Returns `GenerateResult` with `status`, `run_id`, `outputs` (list of `OutputAsset`).
- `OutputAsset.url` can be a remote URL or `data:image/png;base64,...` data URL.

### GPU pipelines

The `serve` function runs on a lightweight image (no torch). GPU inference runs in a separate `@app.cls` with its own image. See `pipelines/z_image_turbo.py` for a complete reference.

- Define a `gpu_image` with torch, diffusers, and model-specific deps.
- Download model weights at image build time via `.run_commands()` with `snapshot_download`. Loads once, cached across deploys.
- Use `@app.cls(image=gpu_image, gpu="A10G")` with `@modal.enter()` for model loading at container startup.
- The generate function calls `Model().method.remote(...)` — cross-function RPC within Modal.
- Keep heavy imports (`torch`, `diffusers`) inside class methods only. The serve image does not have them.
- Return image bytes from the GPU class; the generate function encodes to base64 data URL.
- Include `seed` in `OutputAsset.metadata` for reproducibility.

## Modal patterns

This server runs on [Modal](https://modal.com) — a serverless cloud platform. The Modal app is defined in `pipelines/__init__.py`. Key concepts for pipeline authors:

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

Pipelines that call external APIs (Replicate, OpenAI, Stability, etc.) need secrets. Modal manages these securely — never hardcode keys in pipeline code.

Modal secrets have two independent names: the **secret name** (what you pass to `from_name()`) and the **environment variable name(s)** stored inside it (what you read from `os.environ`). These are configured separately in the Modal dashboard.

In code, attach secrets to the function or class and read them from `os.environ`:

```python
@app.cls(image=gpu_image, gpu="A10G", secrets=[modal.Secret.from_name("replicate-api-key")])
class MyModel:
    @modal.enter()
    def load(self):
        import os
        self.api_key = os.environ["REPLICATE_API_TOKEN"]
```

The user must create the secret in the Modal dashboard before the pipeline will work. When a pipeline needs a secret, tell the user:

1. Go to https://modal.com/secrets
2. Click "Create new secret"
3. Name it (kebab-case, e.g. `replicate-api-key`)
4. Add the required environment variable(s) and values
5. Restart the dev server from VS Code

### Style rules

- Always `import modal` then use qualified names: `modal.Image`, `modal.enter()`.
- Names use kebab-case: `modal.App("lumen-example")`.
- Never use deprecated Modal features — Modal prints warnings when they're used.
- Docs: [modal.com/docs](https://modal.com/docs), examples: [modal.com/docs/examples](https://modal.com/docs/examples).

### `dimensions` param handling

The `dimensions` param arrives as `{"w": int, "h": int}`. Always type-check with `isinstance(dims, dict)` and provide fallback defaults.

## Auth

The server requires a Bearer token on every request. The VS Code extension generates the key at `.authkey` in the engine root (gitignored) before starting `modal serve`. The server reads this file — it never generates the key itself.

- `app.py` mounts `.authkey` into the Modal container via `add_local_file`.
- Pipeline authors do not need to think about auth — middleware handles it.
- Tests import the key from `app.py` and include it in the test client.
- If `.authkey` is missing, the server fails loudly at startup.

## What NOT to modify

- `app.py` — auto-discovers pipelines, no changes needed
- `pipelines/_types.py` — Pydantic models shared with the VS Code client
- `pipelines/_registry.py` — framework code
- `pipelines/__init__.py` — Modal app + re-exports
- `tests/test_api.py` — contract tests (validates all pipelines automatically)

## Rules

- Types are Pydantic models in `pipelines/_types.py`, re-exported from `pipelines`. Import as `from pipelines import PipelineConfig, ...`. Do not add new param types without also updating `packages/lumen/types/schema.ts`.
- JSON responses use camelCase `runId` (not `run_id`) — handled by `GenerateResult.to_wire()`.
- Pipeline `id` must be a unique kebab-case slug.
- Files starting with `_` are skipped by discovery.

## Workflow

The VS Code extension manages the dev server (`modal serve`) and hot-reloads automatically. You do NOT run the server yourself — just write code and validate.

```sh
bun run test         # pytest — validate schema + contract compliance
bun run lint         # ruff check
```

After saving a pipeline file, the extension hot-reloads the server. Check `lumen.log` in this directory for server output and errors.

## Gotchas

- Hot-reload silently fails when a new `@app.cls` with an unbuilt image is added. The user must restart the dev server from VS Code after adding a new GPU pipeline. Subsequent file edits hot-reload normally.
- `ruff check` line-length limit is 100 chars. Long strings need parenthesized multi-line concatenation.
- Server logs go to `lumen.log` in this directory — read this file to diagnose runtime errors.
