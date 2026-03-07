"""Z-Image Turbo pipeline — fast image generation with Alibaba's 6B diffusion model."""

from __future__ import annotations

import uuid
from typing import Any

import modal

from pipelines import (
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
    app,
)

config = PipelineConfig(
    id="z-image-turbo",
    name="Z-Image Turbo",
    category="image",
    params=[
        PromptParam(name="prompt", label="Prompt", required=True, group="basic"),
        DimensionsParam(
            name="dimensions",
            label="Dimensions",
            group="basic",
            default=Dimensions(w=1024, h=1024),
            presets=[
                DimensionPreset(w=512, h=512, label="1:1 SM"),
                DimensionPreset(w=1024, h=1024, label="1:1"),
                DimensionPreset(w=1536, h=1536, label="1:1 LG"),
                DimensionPreset(w=1024, h=768, label="4:3"),
                DimensionPreset(w=768, h=1024, label="3:4"),
                DimensionPreset(w=1280, h=1024, label="5:4"),
                DimensionPreset(w=1024, h=1280, label="4:5"),
                DimensionPreset(w=1024, h=576, label="16:9"),
                DimensionPreset(w=576, h=1024, label="9:16"),
                DimensionPreset(w=1280, h=640, label="2:1"),
                DimensionPreset(w=640, h=1280, label="1:2"),
            ],
        ),
        SeedParam(name="seed", label="Seed", group="advanced"),
        IntegerParam(
            name="num_steps",
            label="Steps",
            group="advanced",
            default=9,
            min=4,
            max=20,
        ),
    ],
    output=PipelineOutput(type="image", format="png"),
)

MODEL_ID = "Tongyi-MAI/Z-Image-Turbo"

gpu_image = (
    modal.Image.debian_slim(python_version="3.12")
    .pip_install(
        "torch>=2.4.0",
        "diffusers>=0.32.0",
        "transformers>=4.40.0",
        "accelerate>=0.30.0",
        "sentencepiece>=0.2.0",
        "safetensors>=0.4.0",
        "pydantic>=2.0.0",
    )
    .run_commands(
        "python -c \""
        "from huggingface_hub import snapshot_download; "
        f"snapshot_download('{MODEL_ID}')\"",
    )
)


@app.cls(image=gpu_image, gpu="A10G", timeout=120)
class ZImageTurboModel:
    @modal.enter()
    def load(self):
        import torch
        from diffusers import ZImagePipeline

        self.pipe = ZImagePipeline.from_pretrained(
            MODEL_ID, torch_dtype=torch.bfloat16
        )
        self.pipe.to("cuda")

    @modal.method()
    def inference(
        self, prompt: str, width: int, height: int, seed: int, num_steps: int
    ) -> bytes:
        import io

        import torch

        image = self.pipe(
            prompt=prompt,
            width=width,
            height=height,
            num_inference_steps=num_steps,
            guidance_scale=0.0,
            generator=torch.Generator("cuda").manual_seed(seed),
        ).images[0]

        buf = io.BytesIO()
        image.save(buf, format="PNG")
        return buf.getvalue()


async def generate(params: dict[str, Any]) -> GenerateResult:
    import base64
    import random

    prompt = params.get("prompt", "")
    if not prompt:
        return GenerateResult(
            status="failed",
            run_id=uuid.uuid4().hex[:12],
            error={"code": "MISSING_PROMPT", "message": "Prompt is required"},
        )

    dims = params.get("dimensions", {})
    width = dims.get("w", 1024) if isinstance(dims, dict) else 1024
    height = dims.get("h", 1024) if isinstance(dims, dict) else 1024
    seed = params.get("seed") if params.get("seed") is not None else random.randint(0, 2**32 - 1)
    num_steps = params.get("num_steps", 9)

    run_id = uuid.uuid4().hex[:12]

    model = ZImageTurboModel()
    image_bytes = await model.inference.remote.aio(prompt, width, height, seed, num_steps)

    data_url = f"data:image/png;base64,{base64.b64encode(image_bytes).decode()}"

    return GenerateResult(
        status="completed",
        run_id=run_id,
        outputs=[OutputAsset(url=data_url, type="image", format="png", metadata={"seed": seed})],
    )
