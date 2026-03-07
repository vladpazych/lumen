# apps/pipelines/CLAUDE.md

FastAPI inference server for Imagic pipelines, deployed on Modal.

## Rules

- Python dataclasses in `pipelines/types.py` are the contract. Mirror changes to `apps/vscode/shared/types.ts`.
- JSON responses use camelCase keys (`runId`, not `run_id`) to match the wire contract.
- `registry.py` is the only coupling point — pipelines self-register on import.
- Tests use FastAPI's `TestClient` — no Modal dependency needed for testing.

### Adding a pipeline

Each pipeline is a single file in `pipelines/` with three parts: config, generate function, registration call.

1. Define a `PipelineConfig` with `id`, `name`, `category`, `params`, `output`.
2. Define `async def generate(params: dict[str, Any]) -> GenerateResult`.
3. Call `registry.register(config, generate)` at module level.
4. Import the module in `app.py` to trigger registration.

### Schema param types

Param type determines the UI control rendered by imagic-vscode. Discriminated on `type` field.

| Type         | Dataclass         | UI control                         | Key fields                                              |
| :----------- | :---------------- | :--------------------------------- | :------------------------------------------------------ |
| `prompt`     | `PromptParam`     | Multiline textarea (primary input) | `default`                                               |
| `text`       | `TextParam`       | Text input or textarea             | `default`, `multiline`                                  |
| `number`     | `NumberParam`     | Number input with constraints      | `default`, `min`, `max`, `step`                         |
| `integer`    | `IntegerParam`    | Integer input with constraints     | `default`, `min`, `max`                                 |
| `boolean`    | `BooleanParam`    | Checkbox                           | `default`                                               |
| `select`     | `SelectParam`     | Dropdown                           | `options: list[SelectOption]`, `default`                |
| `seed`       | `SeedParam`       | Number input + randomize button    | `default`                                               |
| `dimensions` | `DimensionsParam` | Preset buttons + custom w/h        | `default: Dimensions`, `presets: list[DimensionPreset]` |
| `image`      | `ImageParam`      | Upload (future)                    | —                                                       |
| `video`      | `VideoParam`      | Upload (future)                    | —                                                       |

All params share: `name` (wire key), `label` (display), `required`, `group` (visual grouping — `"basic"` shown first, `"advanced"` collapsed).

### Generate function contract

- Receives `params: dict[str, Any]` — keys match param `name` fields. `dimensions` arrives as `{"w": int, "h": int}`.
- Returns `GenerateResult` with `status`, `run_id`, `outputs` (list of `OutputAsset`).
- `OutputAsset.url` can be a remote URL or `data:image/png;base64,...` data URL. The extension handles both.
- Validate required params and return `status="failed"` with `error={"code": ..., "message": ...}` on bad input.

### Modal GPU pipelines

- Define a `modal.Image` with pinned dependency versions. Bake model weights at build time via `.run_commands()`.
- Use `@app.cls(image=..., gpu="A10G")` for the inference class. Load model in `@modal.enter()`.
- The generate function instantiates the class and calls `.remote()`.
- `app` is imported from `pipelines/__init__.py`.

## Commands

```sh
uv sync              # Install Python deps
bun run dev          # modal serve (hot-reload dev server)
bun run test         # pytest
bun run lint         # ruff check
```
