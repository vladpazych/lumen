"""Nano Banana Pro — Gemini 3 Pro high-quality generation via fal.ai (CPU proxy)."""

from __future__ import annotations

from typing import Any

from lumen_sdk import (
    GenerateResult,
    ImageParam,
    PipelineConfig,
    PipelineOutput,
    PromptParam,
    SelectOption,
)

from pipelines._fal import run_fal, shared_params

serve_secrets = ["fal-api-key"]

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
        ImageParam(
            name="image_urls",
            label="Reference Images",
            group="basic",
            maxItems=14,
        ),
        *shared_params([
            SelectOption(value="1K"),
            SelectOption(value="2K"),
            SelectOption(value="4K"),
        ]),
    ],
    output=PipelineOutput(type="image[]", format="png"),
    tier=2,
)


async def generate(params: dict[str, Any]) -> GenerateResult:
    return await run_fal(
        "fal-ai/nano-banana-pro",
        params,
        image_param="image_urls",
    )
