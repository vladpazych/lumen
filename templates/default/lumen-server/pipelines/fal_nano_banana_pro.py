"""Nano Banana Pro — Gemini 3 Pro high-quality generation via fal.ai (CPU proxy)."""

from __future__ import annotations

from typing import Any

from pipelines import (
    GenerateResult,
    PipelineConfig,
    PipelineOutput,
    PromptParam,
    SelectOption,
)
from pipelines._fal import run_fal, shared_params

config = PipelineConfig(
    id="fal-nano-banana-pro",
    name="Nano Banana Pro",
    category="image",
    params=[
        PromptParam(
            name="prompt",
            label="Prompt",
            required=True,
            group="basic",
        ),
        *shared_params([
            SelectOption(value="1K"),
            SelectOption(value="2K"),
            SelectOption(value="4K"),
        ]),
    ],
    output=PipelineOutput(type="image", format="png"),
)


async def generate(params: dict[str, Any]) -> GenerateResult:
    return await run_fal("fal-ai/nano-banana-pro", params)
