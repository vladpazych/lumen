"""Text-to-image pipeline — FLUX.1-dev + Uncensored V2 LoRA on Modal A100 GPU.

Optimized for realistic portraits. Uses natural-language prompts with camera/lens
specs and lighting descriptions rather than keyword lists. No negative prompt
support (FLUX architecture limitation).
"""

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
    NumberParam,
    OutputAsset,
    PipelineConfig,
    PipelineOutput,
    PromptParam,
    SeedParam,
)

BASE_MODEL_ID = "black-forest-labs/FLUX.1-dev"
LORA_MODEL_ID = "enhanceaiteam/Flux-Uncensored-V2"
LORA_FILENAME = "lora.safetensors"

hf_secret = modal.Secret.from_name("huggingface")

gpu_image = (
    modal.Image.debian_slim(python_version="3.12")
    .pip_install(
        "diffusers==0.32.2",
        "transformers==4.47.1",
        "accelerate==1.2.1",
        "torch>=2.2.0",
        "safetensors>=0.4.0",
        "peft>=0.14.0",
        "sentencepiece>=0.2.0",
        "protobuf>=4.25.0",
    )
    .run_commands(
        # Verify peft is importable (diffusers needs it for LoRA loading)
        "python -c 'import peft; print(f\"peft {peft.__version__} OK\")'",
    )
    .run_commands(
        # Bake base model weights into the image (gated repo — needs HF token)
        "python -c \""
        "from diffusers import FluxPipeline; "
        "import torch; "
        f"FluxPipeline.from_pretrained('{BASE_MODEL_ID}', torch_dtype=torch.bfloat16)"
        "\"",
        # Bake LoRA weights into the image
        "python -c \""
        "from huggingface_hub import hf_hub_download; "
        f"hf_hub_download('{LORA_MODEL_ID}', '{LORA_FILENAME}')"
        "\"",
        secrets=[hf_secret],
        gpu="A100",
    )
)

config = PipelineConfig(
    id="flux_uncensored",
    name="FLUX Uncensored",
    description=(
        "FLUX.1-dev with Uncensored V2 LoRA — realistic text-to-image generation. "
        "Write natural-language prompts describing camera, lighting, and subject details."
    ),
    category="image",
    params=[
        PromptParam(name="prompt", label="Prompt", required=True, group="basic"),
        DimensionsParam(
            name="dimensions",
            label="Dimensions",
            group="basic",
            default=Dimensions(w=1024, h=1024),
            presets=[
                DimensionPreset(w=1024, h=1024, label="1024×1024"),
                DimensionPreset(w=832, h=1216, label="832×1216 Portrait"),
                DimensionPreset(w=1216, h=832, label="1216×832 Landscape"),
                DimensionPreset(w=768, h=1024, label="768×1024 Portrait"),
            ],
        ),
        NumberParam(
            name="guidance_scale",
            label="Guidance Scale",
            group="advanced",
            default=3.5,
            min=1.0,
            max=10.0,
            step=0.1,
        ),
        IntegerParam(name="steps", label="Steps", group="advanced", default=30, min=10, max=50),
        SeedParam(name="seed", label="Seed", group="advanced"),
    ],
    output=PipelineOutput(type="image", format="png"),
)


@app.cls(image=gpu_image, gpu="A100", secrets=[hf_secret])
class FluxUncensored:
    @modal.enter()
    def load_model(self):
        import peft  # noqa: F401 — must be importable for diffusers LoRA loading
        import torch
        from diffusers import FluxPipeline

        print(f"peft version: {peft.__version__}")

        self.pipe = FluxPipeline.from_pretrained(
            BASE_MODEL_ID, torch_dtype=torch.bfloat16
        )
        self.pipe.load_lora_weights(LORA_MODEL_ID, weight_name=LORA_FILENAME)
        self.pipe.to("cuda")

    @modal.method()
    def run(
        self,
        prompt: str,
        w: int,
        h: int,
        steps: int,
        guidance_scale: float,
        seed: int | None,
    ) -> str:
        import torch

        generator = torch.Generator("cuda")
        if seed is not None and seed >= 0:
            generator.manual_seed(seed)

        image = self.pipe(
            prompt=prompt,
            width=w,
            height=h,
            num_inference_steps=steps,
            guidance_scale=guidance_scale,
            max_sequence_length=512,
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

    dims = params.get("dimensions", {"w": 1024, "h": 1024})
    w = dims.get("w", 1024) if isinstance(dims, dict) else 1024
    h = dims.get("h", 1024) if isinstance(dims, dict) else 1024
    steps = params.get("steps", 30)
    guidance_scale = params.get("guidance_scale", 3.5)
    seed = params.get("seed")

    model = FluxUncensored()
    data_url = await model.run.remote.aio(
        prompt=prompt, w=w, h=h, steps=steps, guidance_scale=guidance_scale, seed=seed
    )

    return GenerateResult(
        status="completed",
        run_id=uuid.uuid4().hex[:12],
        outputs=[OutputAsset(url=data_url, type="image", format="png")],
    )


registry.register(config, generate)
