"""<Pipeline name> — <one-line description>.

Copy this file, rename it, and fill in the blanks.
Filename doesn't matter — auto-discovery finds all pipelines/*.py files.
Files starting with _ are skipped.
"""

from __future__ import annotations

import uuid
from typing import Any

from lumen_server import (
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
        # More param examples (uncomment as needed):
        #
        # NumberParam(name="strength", label="Strength",
        #     default=0.7, min=0, max=1, step=0.05,
        #     display="slider", group="basic"),
        # IntegerParam(name="steps", label="Steps",
        #     default=30, min=1, max=100,
        #     display="slider", group="advanced"),
        # SelectParam(name="style", label="Style",
        #     options=[SelectOption(value="photo"),
        #              SelectOption(value="anime")],
        #     display="toggle", group="basic"),
        # SelectParam(name="model", label="Model",
        #     options=[SelectOption(value="v1"),
        #              SelectOption(value="v2")],
        #     allowCustom=True, group="advanced"),
        # TagsParam(name="tags", label="Tags",
        #     options=[SelectOption(value="HDR"),
        #              SelectOption(value="cinematic")],
        #     group="advanced"),
        # ImageParam(name="reference",
        #     label="Reference Image", group="basic"),
        # BooleanParam(name="upscale", label="Upscale",
        #     default=False,
        #
        #     group="advanced"),
    ],
    output=PipelineOutput(type="image", format="png"),
    tier=1,  # 1-5 cost hint shown on Generate button (1=free, 5=ultra)
)


async def generate(params: dict[str, Any]) -> GenerateResult:
    prompt = params.get("prompt", "")
    run_id = uuid.uuid4().hex[:12]

    # --- Replace with actual inference ---
    url = f"https://placehold.co/512x512?text={prompt[:40]}"

    return GenerateResult(
        status="completed",
        run_id=run_id,
        outputs=[OutputAsset(url=url, type="image", format="png")],
    )
