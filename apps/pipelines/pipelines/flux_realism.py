"""Ultra-realistic portrait pipeline — FLUX.1-dev + ControlNet Pose + Realism & Uncensored LoRAs on Modal A100.

Structured prompt fields (subject, expression, outfit, setting, lighting, camera shot)
compose into an optimized prompt. Predefined OpenPose skeletons drive ControlNet pose
conditioning for body/face control. Stacked LoRAs: Super Realism (0.8) + Uncensored V2 (0.6).
"""

from __future__ import annotations

import base64
import io
import random
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
    SeedParam,
    SelectOption,
    SelectParam,
    TextParam,
)

BASE_MODEL_ID = "black-forest-labs/FLUX.1-dev"
CONTROLNET_MODEL_ID = "Shakker-Labs/FLUX.1-dev-ControlNet-Union-Pro"
LORA_REALISM_ID = "strangerzonehf/Flux-Super-Realism-LoRA"
LORA_REALISM_FILENAME = "super-realism.safetensors"
LORA_UNCENSORED_ID = "enhanceaiteam/Flux-Uncensored-V2"
LORA_UNCENSORED_FILENAME = "lora.safetensors"
CONTROL_MODE_POSE = 4
PROGRESS_DICT_NAME = "imagic-progress"
# Modal A100-40GB rate: ~$3.00/hr
GPU_COST_PER_SEC = 3.00 / 3600

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
        "Pillow>=10.0.0",
    )
    .run_commands(
        "python -c 'import peft; print(f\"peft {peft.__version__} OK\")'",
    )
    .run_commands(
        # Bake ControlNet weights
        "python -c \""
        "from diffusers.models import FluxControlNetModel; "
        "import torch; "
        f"FluxControlNetModel.from_pretrained('{CONTROLNET_MODEL_ID}', torch_dtype=torch.bfloat16)"
        "\"",
        # Bake base model weights (gated — needs HF token + GPU for init)
        "python -c \""
        "from diffusers import FluxControlNetPipeline; "
        "from diffusers.models import FluxControlNetModel; "
        "import torch; "
        f"cn = FluxControlNetModel.from_pretrained('{CONTROLNET_MODEL_ID}', torch_dtype=torch.bfloat16); "
        f"FluxControlNetPipeline.from_pretrained('{BASE_MODEL_ID}', controlnet=cn, "
        "torch_dtype=torch.bfloat16)"
        "\"",
        # Bake LoRA weights
        "python -c \""
        "from huggingface_hub import hf_hub_download; "
        f"hf_hub_download('{LORA_REALISM_ID}', '{LORA_REALISM_FILENAME}'); "
        f"hf_hub_download('{LORA_UNCENSORED_ID}', '{LORA_UNCENSORED_FILENAME}')"
        "\"",
        secrets=[hf_secret],
        gpu="A100",
    )
)

# --- Prompt composition ---

LIGHTING_LABELS = {
    "natural_daylight": "natural daylight",
    "golden_hour": "golden hour warm",
    "studio_softbox": "studio softbox",
    "dramatic_side": "dramatic side lighting",
    "neon": "neon",
    "overcast": "overcast soft diffused",
}

CAMERA_LABELS = {
    "close_up_portrait": "close-up portrait",
    "upper_body": "upper body shot",
    "full_body": "full body shot",
    "three_quarter": "three-quarter view",
}


def compose_prompt(
    subject: str,
    expression: str,
    outfit: str | None,
    setting: str | None,
    lighting: str,
    camera_shot: str,
) -> str:
    parts = [f"Ultra realistic RAW photograph of {subject}"]
    parts.append(f"{expression} expression")
    if outfit:
        parts.append(f"wearing {outfit}")
    if setting:
        parts.append(f"in {setting}")
    parts.append(f"{LIGHTING_LABELS.get(lighting, lighting)} lighting")
    parts.append(CAMERA_LABELS.get(camera_shot, camera_shot))
    parts.append(
        "sharp focus, 8k UHD, highly detailed skin texture and pores, "
        "photorealistic, film grain, subsurface scattering"
    )
    return ", ".join(parts)


# --- Pipeline config ---

config = PipelineConfig(
    id="flux_realism",
    name="FLUX Realism",
    description=(
        "Ultra-realistic portrait generation with pose control. "
        "FLUX.1-dev + ControlNet Union Pro (pose) + Super Realism & Uncensored V2 LoRAs. "
        "Structured fields compose into an optimized prompt automatically."
    ),
    category="image",
    params=[
        SelectParam(
            name="quality",
            label="Quality",
            group="basic",
            default="preview",
            options=[
                SelectOption(value="preview", label="Preview (fast)"),
                SelectOption(value="full", label="Full"),
            ],
        ),
        TextParam(
            name="subject",
            label="Subject",
            required=True,
            group="basic",
            default="a 25-year-old woman with brown curly hair and green eyes",
        ),
        SelectParam(
            name="expression",
            label="Expression",
            group="basic",
            default="neutral",
            options=[
                SelectOption(value="neutral", label="Neutral"),
                SelectOption(value="smiling", label="Smiling"),
                SelectOption(value="serious", label="Serious"),
                SelectOption(value="laughing", label="Laughing"),
                SelectOption(value="contemplative", label="Contemplative"),
                SelectOption(value="surprised", label="Surprised"),
            ],
        ),
        TextParam(name="outfit", label="Outfit", group="basic"),
        TextParam(name="setting", label="Setting", group="basic"),
        SelectParam(
            name="lighting",
            label="Lighting",
            group="basic",
            default="natural_daylight",
            options=[
                SelectOption(value="natural_daylight", label="Natural Daylight"),
                SelectOption(value="golden_hour", label="Golden Hour"),
                SelectOption(value="studio_softbox", label="Studio Softbox"),
                SelectOption(value="dramatic_side", label="Dramatic Side"),
                SelectOption(value="neon", label="Neon"),
                SelectOption(value="overcast", label="Overcast"),
            ],
        ),
        SelectParam(
            name="camera_shot",
            label="Camera Shot",
            group="basic",
            default="upper_body",
            options=[
                SelectOption(value="close_up_portrait", label="Close-up Portrait"),
                SelectOption(value="upper_body", label="Upper Body"),
                SelectOption(value="full_body", label="Full Body"),
                SelectOption(value="three_quarter", label="Three-Quarter"),
            ],
        ),
        SelectParam(
            name="pose",
            label="Pose",
            group="basic",
            default="standing_front",
            options=[
                SelectOption(value="standing_front", label="Standing (Front)"),
                SelectOption(value="standing_confident", label="Standing (Confident)"),
                SelectOption(value="sitting_casual", label="Sitting (Casual)"),
                SelectOption(value="walking", label="Walking"),
                SelectOption(value="portrait_headshot", label="Portrait Headshot"),
                SelectOption(value="leaning", label="Leaning"),
                SelectOption(value="crossed_arms", label="Crossed Arms"),
                SelectOption(value="dynamic", label="Dynamic"),
            ],
        ),
        DimensionsParam(
            name="dimensions",
            label="Dimensions",
            group="advanced",
            default=Dimensions(w=1024, h=1024),
            presets=[
                DimensionPreset(w=1024, h=1024, label="1024\u00d71024"),
                DimensionPreset(w=832, h=1216, label="832\u00d71216 Portrait"),
                DimensionPreset(w=1216, h=832, label="1216\u00d7832 Landscape"),
                DimensionPreset(w=768, h=1024, label="768\u00d71024 Portrait"),
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
        NumberParam(
            name="controlnet_scale",
            label="ControlNet Scale",
            group="advanced",
            default=0.6,
            min=0.1,
            max=1.0,
            step=0.05,
        ),
        IntegerParam(name="steps", label="Steps", group="advanced", default=28, min=10, max=50),
        SeedParam(name="seed", label="Seed", group="advanced"),
    ],
    output=PipelineOutput(type="image", format="png"),
)


# --- Modal GPU class ---


@app.cls(image=gpu_image, gpu="A100", secrets=[hf_secret])
class FluxRealism:
    @modal.enter()
    def load_model(self):
        import peft  # noqa: F401 — must be importable for diffusers LoRA loading
        import torch
        from diffusers import FluxControlNetPipeline
        from diffusers.models import FluxControlNetModel

        print(f"peft version: {peft.__version__}")

        controlnet = FluxControlNetModel.from_pretrained(
            CONTROLNET_MODEL_ID, torch_dtype=torch.bfloat16
        )
        self.pipe = FluxControlNetPipeline.from_pretrained(
            BASE_MODEL_ID, controlnet=controlnet, torch_dtype=torch.bfloat16
        )
        self.pipe.load_lora_weights(
            LORA_REALISM_ID, weight_name=LORA_REALISM_FILENAME, adapter_name="realism"
        )
        self.pipe.load_lora_weights(
            LORA_UNCENSORED_ID, weight_name=LORA_UNCENSORED_FILENAME, adapter_name="uncensored"
        )
        self.pipe.set_adapters(["realism", "uncensored"], adapter_weights=[0.8, 0.6])
        self.pipe.enable_model_cpu_offload()

    @modal.method()
    def run(
        self,
        prompt: str,
        pose_image_bytes: bytes,
        w: int,
        h: int,
        steps: int,
        guidance_scale: float,
        controlnet_scale: float,
        seed: int | None,
        run_id: str = "",
        metadata: dict[str, Any] | None = None,
    ) -> str:
        import time

        import torch
        from PIL import Image

        progress = (
            modal.Dict.from_name(PROGRESS_DICT_NAME, create_if_missing=True) if run_id else None
        )

        def on_step_end(_pipe: Any, step: int, _timestep: int, callback_kwargs: dict) -> dict:
            if progress and run_id:
                progress.put(run_id, {
                    "status": "running",
                    "step": step + 1,
                    "total_steps": steps,
                })
            return callback_kwargs

        t0 = time.monotonic()

        try:
            pose_image = Image.open(io.BytesIO(pose_image_bytes)).convert("RGB")

            # "cpu" generator required when using enable_model_cpu_offload
            generator = torch.Generator("cpu")
            if seed is not None and seed >= 0:
                generator.manual_seed(seed)

            image = self.pipe(
                prompt=prompt,
                control_image=pose_image,
                control_mode=CONTROL_MODE_POSE,
                controlnet_conditioning_scale=controlnet_scale,
                width=w,
                height=h,
                num_inference_steps=steps,
                guidance_scale=guidance_scale,
                max_sequence_length=512,
                generator=generator,
                callback_on_step_end=on_step_end,
            ).images[0]

            duration_s = round(time.monotonic() - t0, 1)
            cost_usd = round(duration_s * GPU_COST_PER_SEC, 4)

            buf = io.BytesIO()
            image.save(buf, format="PNG")
            b64 = base64.b64encode(buf.getvalue()).decode("ascii")
            data_url = f"data:image/png;base64,{b64}"

            run_metadata = {
                **(metadata or {}),
                "duration_s": duration_s,
                "cost_usd": cost_usd,
                "gpu": "A100",
            }

            if progress and run_id:
                progress.put(run_id, {
                    "status": "completed",
                    "step": steps,
                    "total_steps": steps,
                    "data_url": data_url,
                    "metadata": run_metadata,
                })

            return data_url

        except Exception as e:
            if progress and run_id:
                progress.put(run_id, {
                    "status": "failed",
                    "error": {"code": "GENERATION_FAILED", "message": str(e)},
                })
            raise


# --- Generate function ---


async def generate(params: dict[str, Any]) -> GenerateResult:
    subject = params.get("subject", "")
    if not subject:
        return GenerateResult(
            status="failed",
            run_id=uuid.uuid4().hex[:12],
            error={"code": "MISSING_SUBJECT", "message": "Subject description is required."},
        )

    expression = params.get("expression", "neutral")
    outfit = params.get("outfit") or None
    setting = params.get("setting") or None
    lighting = params.get("lighting", "natural_daylight")
    camera_shot = params.get("camera_shot", "upper_body")
    pose_name = params.get("pose", "standing_front")

    quality = params.get("quality", "preview")

    dims = params.get("dimensions", {"w": 1024, "h": 1024})
    w = dims.get("w", 1024) if isinstance(dims, dict) else 1024
    h = dims.get("h", 1024) if isinstance(dims, dict) else 1024
    steps = params.get("steps", 28)
    guidance_scale = params.get("guidance_scale", 3.5)
    controlnet_scale = params.get("controlnet_scale", 0.6)
    seed = params.get("seed")

    # Auto-generate seed so previews are reproducible in full mode
    if seed is None or seed == "":
        seed = random.randint(0, 2147483647)

    # Preview: half resolution, fewer steps for fast iteration
    if quality == "preview":
        w = (w // 2 // 8) * 8  # round down to multiple of 8 (diffusion requirement)
        h = (h // 2 // 8) * 8
        steps = 10

    prompt = compose_prompt(subject, expression, outfit, setting, lighting, camera_shot)

    # Render pose skeleton at target resolution and serialize for Modal transport
    from pipelines.poses import render_pose

    pose_image = render_pose(pose_name, w, h)
    buf = io.BytesIO()
    pose_image.save(buf, format="PNG")
    pose_bytes = buf.getvalue()

    run_id = uuid.uuid4().hex[:12]
    run_metadata = {"seed": seed, "quality": quality}

    # Write initial progress entry
    progress = modal.Dict.from_name(PROGRESS_DICT_NAME, create_if_missing=True)
    await progress.put.aio(run_id, {
        "status": "queued",
        "step": 0,
        "total_steps": steps,
    })

    # Spawn GPU worker — returns immediately
    model = FluxRealism()
    model.run.spawn(
        prompt=prompt,
        pose_image_bytes=pose_bytes,
        w=w,
        h=h,
        steps=steps,
        guidance_scale=guidance_scale,
        controlnet_scale=controlnet_scale,
        seed=seed,
        run_id=run_id,
        metadata=run_metadata,
    )

    return GenerateResult(
        status="running",
        run_id=run_id,
        progress=0.0,
    )


registry.register(config, generate)
