"""Echo pipeline — returns a placeholder image without extra setup."""

from __future__ import annotations

import uuid
from typing import Any

config = {
    "id": "echo",
    "name": "Echo",
    "category": "image",
    "params": [
        {
            "type": "prompt",
            "name": "prompt",
            "label": "Prompt",
            "required": True,
            "group": "basic",
            "placeholder": "Describe the image to render",
        }
    ],
    "output": {"type": "image", "format": "png"},
    "tier": 1,
}


async def generate(params: dict[str, Any]) -> dict[str, Any]:
    prompt = str(params.get("prompt", "no prompt"))
    text = prompt[:80].replace(" ", "+")
    url = f"https://placehold.co/512x512/1a1a2e/e0e0ff?text={text}"

    return {
        "status": "completed",
        "runId": uuid.uuid4().hex[:12],
        "outputs": [{"url": url, "type": "image", "format": "png"}],
    }
