"""<Pipeline name> — <one-line description>.

Copy this file, rename it, and fill in the blanks.
Filename doesn't matter — auto-discovery finds all pipelines/*.py files.
Files starting with _ are skipped.
"""

from __future__ import annotations

import uuid
from typing import Any

from pipelines.types import (
    GenerateResult,
    OutputAsset,
    PipelineConfig,
    PipelineOutput,
    PromptParam,
)

config = PipelineConfig(
    id="my-pipeline",
    name="My Pipeline",
    description="Does something useful.",
    category="image",
    params=[
        PromptParam(name="prompt", label="Prompt", required=True, group="basic"),
        # See CLAUDE.md for all available param types
    ],
    output=PipelineOutput(type="image", format="png"),
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
