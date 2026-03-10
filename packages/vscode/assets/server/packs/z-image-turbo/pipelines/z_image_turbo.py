"""Z-Image Turbo pipeline — fast image generation with Alibaba's 6B diffusion model."""

from __future__ import annotations

import base64
import random
import uuid
from typing import Any

import modal

from lumen_server.modal_app import app

config = {
    "id": "z-image-turbo",
    "name": "Z-Image Turbo",
    "category": "image",
    "params": [
        {
            "type": "prompt",
            "name": "prompt",
            "label": "Prompt",
            "required": True,
            "group": "basic",
        },
        {
            "type": "dimensions",
            "name": "dimensions",
            "label": "Dimensions",
            "group": "basic",
            "default": {"w": 1024, "h": 1024},
            "presets": [
                {"w": 512, "h": 512, "label": "1:1 SM"},
                {"w": 1024, "h": 1024, "label": "1:1"},
                {"w": 1536, "h": 1536, "label": "1:1 LG"},
                {"w": 1024, "h": 768, "label": "4:3"},
                {"w": 768, "h": 1024, "label": "3:4"},
                {"w": 1280, "h": 1024, "label": "5:4"},
                {"w": 1024, "h": 1280, "label": "4:5"},
                {"w": 1024, "h": 576, "label": "16:9"},
                {"w": 576, "h": 1024, "label": "9:16"},
            ],
        },
        {"type": "seed", "name": "seed", "label": "Seed", "group": "advanced"},
        {
            "type": "integer",
            "name": "num_steps",
            "label": "Steps",
            "group": "advanced",
            "default": 9,
            "min": 4,
            "max": 20,
        },
    ],
    "output": {"type": "image", "format": "png"},
    "tier": 3,
}

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
    def load(self) -> None:
        import torch
        from diffusers import ZImagePipeline

        self.pipe = ZImagePipeline.from_pretrained(MODEL_ID, torch_dtype=torch.bfloat16)
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

        buffer = io.BytesIO()
        image.save(buffer, format="PNG")
        return buffer.getvalue()


async def generate(params: dict[str, Any]) -> dict[str, Any]:
    prompt = str(params.get("prompt", ""))
    if not prompt:
        return {
            "status": "failed",
            "runId": uuid.uuid4().hex[:12],
            "error": {"code": "MISSING_PROMPT", "message": "Prompt is required"},
        }

    dims = params.get("dimensions", {})
    width = dims.get("w", 1024) if isinstance(dims, dict) else 1024
    height = dims.get("h", 1024) if isinstance(dims, dict) else 1024
    seed_value = params.get("seed")
    seed = seed_value if isinstance(seed_value, int) else random.randint(0, 2**32 - 1)
    num_steps_value = params.get("num_steps", 9)
    num_steps = num_steps_value if isinstance(num_steps_value, int) else 9

    image_bytes = await ZImageTurboModel().inference.remote.aio(
        prompt, width, height, seed, num_steps
    )
    data_url = f"data:image/png;base64,{base64.b64encode(image_bytes).decode()}"

    return {
        "status": "completed",
        "runId": uuid.uuid4().hex[:12],
        "outputs": [
            {
                "url": data_url,
                "type": "image",
                "format": "png",
                "metadata": {"seed": seed},
            }
        ],
    }
