"""Text-to-image pipeline — SDXL Turbo on Modal A10G GPU."""

from __future__ import annotations

import base64
import io
import uuid
from typing import Any

import modal

from pipelines import app, registry
from pipelines.types import (
    DimensionPreset,
    Dimensions,
    DimensionsParam,
    GenerateResult,
    IntegerParam,
    OutputAsset,
    PipelineConfig,
    PipelineOutput,
    PromptParam,
    SeedParam,
)

MODEL_ID = "stabilityai/sdxl-turbo"

# Modal image with model weights baked in (downloaded at build time, not runtime)
gpu_image = (
    modal.Image.debian_slim(python_version="3.12")
    .pip_install(
        "diffusers==0.32.2",
        "transformers==4.47.1",
        "accelerate==1.2.1",
        "torch>=2.2.0",
        "safetensors>=0.4.0",
    )
    .run_commands(
        "python -c \""
        "from diffusers import AutoPipelineForText2Image; "
        "import torch; "
        f"AutoPipelineForText2Image.from_pretrained('{MODEL_ID}', torch_dtype=torch.float16, variant='fp16')"
        "\""
    )
)

config = PipelineConfig(
    id="txt2img",
    name="Text to Image",
    description="SDXL Turbo — fast 1-4 step text-to-image generation.",
    category="image",
    params=[
        PromptParam(name="prompt", label="Prompt", required=True, group="basic"),
        DimensionsParam(
            name="dimensions",
            label="Dimensions",
            group="basic",
            default=Dimensions(w=512, h=512),
            presets=[
                DimensionPreset(w=512, h=512, label="512×512"),
                DimensionPreset(w=768, h=512, label="768×512 Landscape"),
                DimensionPreset(w=512, h=768, label="512×768 Portrait"),
            ],
        ),
        IntegerParam(name="steps", label="Steps", group="advanced", default=4, min=1, max=8),
        SeedParam(name="seed", label="Seed", group="advanced"),
    ],
    output=PipelineOutput(type="image", format="png"),
)


@app.cls(image=gpu_image, gpu="A10G")
class TextToImage:
    @modal.enter()
    def load_model(self):
        import torch
        from diffusers import AutoPipelineForText2Image

        self.pipe = AutoPipelineForText2Image.from_pretrained(
            MODEL_ID, torch_dtype=torch.float16, variant="fp16"
        )
        self.pipe.to("cuda")

    @modal.method()
    def run(self, prompt: str, w: int, h: int, steps: int, seed: int | None) -> str:
        import torch

        generator = torch.Generator("cuda")
        if seed is not None and seed >= 0:
            generator.manual_seed(seed)

        # SDXL Turbo needs guidance_scale=0.0 and no negative prompt
        image = self.pipe(
            prompt=prompt,
            width=w,
            height=h,
            num_inference_steps=steps,
            guidance_scale=0.0,
            generator=generator,
        ).images[0]

        buf = io.BytesIO()
        image.save(buf, format="PNG")
        b64 = base64.b64encode(buf.getvalue()).decode("ascii")
        return f"data:image/png;base64,{b64}"


async def generate(params: dict[str, Any]) -> GenerateResult:
    prompt = params.get("prompt", "")
    if not prompt:
        return GenerateResult(
            status="failed",
            run_id=uuid.uuid4().hex[:12],
            error={"code": "MISSING_PROMPT", "message": "Prompt is required."},
        )

    dims = params.get("dimensions", {"w": 512, "h": 512})
    w = dims.get("w", 512) if isinstance(dims, dict) else 512
    h = dims.get("h", 512) if isinstance(dims, dict) else 512
    steps = params.get("steps", 4)
    seed = params.get("seed")

    model = TextToImage()
    data_url = model.run.remote(prompt=prompt, w=w, h=h, steps=steps, seed=seed)

    return GenerateResult(
        status="completed",
        run_id=uuid.uuid4().hex[:12],
        outputs=[OutputAsset(url=data_url, type="image", format="png")],
    )


registry.register(config, generate)
