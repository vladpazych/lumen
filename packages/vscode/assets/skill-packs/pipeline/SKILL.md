---
name: pipeline
description: "Create or edit pipeline files in assets/server/pipelines/. Use when adding a pipeline, wiring inference, defining params, or integrating Modal GPU logic."
---

# Pipeline Authoring

A Lumen pipeline is one Python module in `assets/server/pipelines/` that exports `config` and `generate`.

## Rules

- Export exactly `config` as a plain dict and `generate` as an async function.
- Keep `config["id"]` unique and kebab-case.
- Files starting with `_` are helpers and are not discovered as pipelines.
- Keep pipeline-specific logic in the pipeline module. Shared runtime logic belongs in `assets/server/lumen_server/`.
- If a pipeline needs secrets from `os.environ`, declare `serve_secrets = ["secret-name"]`.

## Minimal Shape

```python
from __future__ import annotations

import uuid
from typing import Any

config = {
    "id": "my-pipeline",
    "name": "My Pipeline",
    "category": "image",
    "params": [
        {
            "type": "prompt",
            "name": "prompt",
            "label": "Prompt",
            "required": True,
            "group": "basic",
        }
    ],
    "output": {"type": "image", "format": "png"},
    "tier": 1,
}


async def generate(params: dict[str, Any]) -> dict[str, Any]:
    return {
        "status": "completed",
        "runId": uuid.uuid4().hex[:12],
        "outputs": [],
    }
```
