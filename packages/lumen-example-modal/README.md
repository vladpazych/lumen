# Lumen Example — Modal

Example inference server for [Lumen](../../), deployed on [Modal](https://modal.com).

Ships a single stub pipeline (`echo`) that returns placeholder images — no GPU required. Use it as a starting point for building your own pipelines.

## Setup

```sh
uv sync          # Install Python dependencies
bun run test     # Verify contract compliance
bun run dev      # Start with modal serve (needs Modal CLI + auth)
```

## Adding a pipeline

1. Copy `pipelines/_template.py` to `pipelines/my_pipeline.py`
2. Define a `PipelineConfig` with parameters and output type
3. Write an `async def generate(params) -> GenerateResult` function

Pipelines are auto-discovered on startup — no registration or imports needed.
