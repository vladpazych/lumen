from __future__ import annotations

from pipelines._fal import run_fal, shared_params

serve_secrets = ["fal-api-key"]

config = {
    "id": "fal-nano-banana",
    "name": "Nano Banana",
    "category": "image",
    "params": [
        {
            "type": "prompt",
            "name": "prompt",
            "label": "Prompt",
            "required": True,
            "group": "basic",
            "placeholder": "Describe the scene",
        },
        *shared_params(
            [
                {"value": "1K", "label": "1K"},
                {"value": "2K", "label": "2K"},
            ]
        ),
    ],
    "output": {"type": "image", "format": "png"},
    "tier": 2,
}


async def generate(params: dict[str, object]) -> dict[str, object]:
    return await run_fal("fal-ai/nano-banana", params)
