# Imagic Server

FastAPI inference server for visual generation pipelines, deployed on [Modal](https://modal.com).

The server declares what each pipeline accepts — prompts, images, sliders, dimensions — and any client speaking the schema contract (`apps/imagic-vscode`, or any HTTP client) renders matching controls automatically. Adding a new pipeline is defining a config and a generate function.

## Setup

```sh
uv sync          # Install Python dependencies
bun run test     # Verify contract compliance
bun run dev      # Start with modal serve (needs Modal CLI + auth)
```

## Adding a pipeline

1. Create `pipelines/my_pipeline.py`
2. Define a `PipelineConfig` with parameters and output type
3. Write an `async def generate(params) -> GenerateResult` function
4. Call `registry.register(config, generate)`
5. Import the module in `app.py`
