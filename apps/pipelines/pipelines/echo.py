"""Echo pipeline — stub that returns placeholder images. Validates the contract without GPU."""

from __future__ import annotations

import uuid
from typing import Any

from pipelines import registry
from pipelines.types import (
    DimensionPreset,
    Dimensions,
    DimensionsParam,
    GenerateResult,
    IntegerParam,
    NumberParam,
    OutputAsset,
    PipelineConfig,
    PipelineOutput,
    PromptParam,
    SeedParam,
    SelectOption,
    SelectParam,
    TextParam,
)

config = PipelineConfig(
    id="echo",
    name="Echo",
    description="Stub pipeline — returns a placeholder image with the prompt overlaid.",
    category="image",
    params=[
        PromptParam(name="prompt", label="Prompt", required=True, group="basic"),
        TextParam(
            name="negative_prompt", label="Negative prompt", group="basic", multiline=True
        ),
        DimensionsParam(
            name="dimensions",
            label="Dimensions",
            group="basic",
            default=Dimensions(w=1024, h=1024),
            presets=[
                DimensionPreset(w=512, h=512, label="512×512"),
                DimensionPreset(w=768, h=768, label="768×768"),
                DimensionPreset(w=1024, h=1024, label="1024×1024"),
                DimensionPreset(w=1024, h=768, label="1024×768 Landscape"),
                DimensionPreset(w=768, h=1024, label="768×1024 Portrait"),
            ],
        ),
        NumberParam(
            name="guidance_scale",
            label="Guidance scale",
            group="advanced",
            default=7.5,
            min=1.0,
            max=20.0,
            step=0.5,
        ),
        IntegerParam(name="steps", label="Steps", group="advanced", default=30, min=1, max=150),
        SeedParam(name="seed", label="Seed", group="advanced"),
        SelectParam(
            name="scheduler",
            label="Scheduler",
            group="advanced",
            default="euler_a",
            options=[
                SelectOption(value="euler_a", label="Euler Ancestral"),
                SelectOption(value="euler", label="Euler"),
                SelectOption(value="dpm_2m", label="DPM++ 2M"),
                SelectOption(value="dpm_2m_karras", label="DPM++ 2M Karras"),
            ],
        ),
    ],
    output=PipelineOutput(type="image", format="png"),
)


async def generate(params: dict[str, Any]) -> GenerateResult:
    prompt = params.get("prompt", "no prompt")
    dims = params.get("dimensions", {"w": 1024, "h": 1024})
    w = dims.get("w", 1024) if isinstance(dims, dict) else 1024
    h = dims.get("h", 1024) if isinstance(dims, dict) else 1024

    # Placeholder image with prompt text overlaid
    text = prompt[:80].replace(" ", "+")
    url = f"https://placehold.co/{w}x{h}/1a1a2e/e0e0ff?text={text}"

    return GenerateResult(
        status="completed",
        run_id=uuid.uuid4().hex[:12],
        outputs=[OutputAsset(url=url, type="image", format="png")],
    )


registry.register(config, generate)
