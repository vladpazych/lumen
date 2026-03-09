---
name: pipeline
description: "Create or edit pipeline files in pipelines/. TRIGGER: user asks to add a pipeline, create a model endpoint, wire up inference, add params. NOT: .lumen files, extension code, framework internals."
---

# Writing a pipeline

A pipeline is a single `.py` file in `pipelines/` that exports `config` and `generate`.

## Minimal example

```python
from __future__ import annotations

import uuid
from typing import Any

from lumen_sdk import (
    GenerateResult,
    OutputAsset,
    PipelineConfig,
    PipelineOutput,
    PromptParam,
)

config = PipelineConfig(
    id="my-pipeline",
    name="My Pipeline",
    category="image",
    params=[
        PromptParam(name="prompt", label="Prompt", required=True, group="basic"),
    ],
    output=PipelineOutput(type="image", format="png"),
    tier=1,
)


async def generate(params: dict[str, Any]) -> GenerateResult:
    prompt = params.get("prompt", "")
    run_id = uuid.uuid4().hex[:12]
    url = f"https://placehold.co/512x512?text={prompt[:40]}"
    return GenerateResult(
        status="completed",
        run_id=run_id,
        outputs=[OutputAsset(url=url, type="image", format="png")],
    )
```

## Rules

- Import types from `lumen_sdk`, not from `pipelines`
- Export exactly `config` (PipelineConfig) and `generate` (async function)
- `id` must be unique kebab-case slug
- Files starting with `_` are skipped by discovery (use for shared helpers)
- Set `tier` (1-5) to indicate cost: 1=free/CPU, 2=budget GPU, 3=mid, 4=high, 5=ultra

## GPU pipelines

For Modal GPU inference, import the app and define a class:

```python
import modal
from lumen_sdk import app

gpu_image = (
    modal.Image.debian_slim(python_version="3.12")
    .pip_install("torch>=2.4.0", "diffusers>=0.32.0")
)

@app.cls(image=gpu_image, gpu="A10G")
class MyModel:
    @modal.enter()
    def load(self):
        import torch
        self.pipe = ...

    @modal.method()
    def inference(self, prompt: str) -> bytes:
        ...
```

Call from generate: `MyModel().inference.remote(prompt)`

## Schema best practices

- Always set `default` on params — empty fields confuse users
- Always set `min`/`max` on numbers — enables slider display and client validation
- Use `group` to separate "basic" from "advanced" params
- Use `hint` for non-obvious params — one line explaining the effect
- Use `placeholder` for format hints in empty inputs
- Use `required=True` only for truly required params (usually just prompt)
- If `generate()` reads a Modal secret from `os.environ`, declare `serve_secrets = ["secret-name"]` in the module so the shared runtime attaches it
