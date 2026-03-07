"""Echo pipeline — returns a placeholder image. Validates the contract without GPU."""

from __future__ import annotations

import uuid
from typing import Any

from pipelines import (
    GenerateResult,
    OutputAsset,
    PipelineConfig,
    PipelineOutput,
    PromptParam,
)

config = PipelineConfig(
    id="echo",
    name="Echo",
    category="image",
    params=[
        PromptParam(name="prompt", label="Prompt", required=True, group="basic"),
    ],
    output=PipelineOutput(type="image", format="png"),
)


async def generate(params: dict[str, Any]) -> GenerateResult:
    prompt = params.get("prompt", "no prompt")
    text = prompt[:80].replace(" ", "+")
    url = f"https://placehold.co/512x512/1a1a2e/e0e0ff?text={text}"

    return GenerateResult(
        status="completed",
        run_id=uuid.uuid4().hex[:12],
        outputs=[OutputAsset(url=url, type="image", format="png")],
    )
