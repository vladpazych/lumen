"""Pipeline template for new Lumen server modules."""

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
            "placeholder": "Describe the scene",
        }
    ],
    "output": {"type": "image", "format": "png"},
    "tier": 1,
}


async def generate(params: dict[str, Any]) -> dict[str, Any]:
    prompt = str(params.get("prompt", ""))
    if not prompt:
        return {
            "status": "failed",
            "runId": uuid.uuid4().hex[:12],
            "error": {"code": "MISSING_PROMPT", "message": "Prompt is required"},
        }

    return {
        "status": "completed",
        "runId": uuid.uuid4().hex[:12],
        "outputs": [],
    }
