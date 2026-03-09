"""Shared fal.ai API helper — not a pipeline (skipped by auto-discovery)."""

from __future__ import annotations

import base64
import os
import uuid
from typing import Any

import httpx
from lumen_sdk import (
    BooleanParam,
    GenerateResult,
    IntegerParam,
    OutputAsset,
    SeedParam,
    SelectOption,
    SelectParam,
)

ASPECT_RATIO_OPTIONS = [
    SelectOption(value="1:1", label="1:1 Square"),
    SelectOption(value="16:9", label="16:9 Landscape"),
    SelectOption(value="9:16", label="9:16 Portrait"),
    SelectOption(value="4:3", label="4:3"),
    SelectOption(value="3:4", label="3:4"),
    SelectOption(value="3:2", label="3:2"),
    SelectOption(value="2:3", label="2:3"),
    SelectOption(value="4:5", label="4:5"),
    SelectOption(value="5:4", label="5:4"),
    SelectOption(value="21:9", label="21:9 Ultrawide"),
]

FORMAT_OPTIONS = [
    SelectOption(value="png"),
    SelectOption(value="jpeg"),
    SelectOption(value="webp"),
]


def shared_params(
    resolution_options: list[SelectOption],
) -> list:
    """Common params shared across all fal.ai nano-banana variants."""
    return [
        SelectParam(
            name="aspect_ratio",
            label="Aspect Ratio",
            default="1:1",
            options=ASPECT_RATIO_OPTIONS,
            group="basic",
        ),
        IntegerParam(
            name="num_images",
            label="Images",
            default=1,
            min=1,
            max=4,
            group="basic",
        ),
        SeedParam(name="seed", label="Seed", group="advanced"),
        SelectParam(
            name="output_format",
            label="Format",
            default="png",
            options=FORMAT_OPTIONS,
            display="toggle",
            group="advanced",
        ),
        SelectParam(
            name="resolution",
            label="Resolution",
            default="1K",
            options=resolution_options,
            group="advanced",
        ),
        BooleanParam(
            name="enable_web_search",
            label="Web Search",
            default=False,
            group="advanced",
        ),
    ]


def _get_api_key() -> str | None:
    return os.environ.get("FAL_KEY")


async def _upload_to_fal_cdn(
    client: httpx.AsyncClient,
    api_key: str,
    image_bytes: bytes,
    content_type: str,
) -> str:
    """Upload raw bytes to fal CDN, return the public URL."""
    init = await client.post(
        "https://rest.fal.ai/storage/upload/initiate"
        "?storage_type=fal-cdn-v3",
        headers={
            "Authorization": f"Key {api_key}",
            "Content-Type": "application/json",
        },
        json={
            "content_type": content_type,
            "file_name": "image.png",
        },
    )
    init.raise_for_status()
    data = init.json()

    put = await client.put(
        data["upload_url"],
        headers={"Content-Type": content_type},
        content=image_bytes,
    )
    put.raise_for_status()
    return data["file_url"]


async def resolve_image(
    client: httpx.AsyncClient,
    api_key: str,
    value: str,
) -> str:
    """Resolve an image value (data URI or HTTP URL) to a fal CDN URL."""
    if value.startswith("http"):
        return value
    if value.startswith("data:"):
        header, b64data = value.split(",", 1)
        content_type = header.split(":")[1].split(";")[0]
        image_bytes = base64.b64decode(b64data)
        return await _upload_to_fal_cdn(
            client, api_key, image_bytes, content_type
        )
    msg = f"Cannot resolve image on server: {value}"
    raise ValueError(msg)


async def run_fal(
    endpoint: str,
    params: dict[str, Any],
    *,
    image_param: str | None = None,
) -> GenerateResult:
    """Call a fal.ai endpoint. Returns a structured result, never throws."""
    api_key = _get_api_key()
    if not api_key:
        return GenerateResult(
            status="failed",
            run_id="",
            error={
                "code": "MISSING_API_KEY",
                "message": (
                    "FAL_KEY not set. Export FAL_KEY=your-key "
                    "before running modal serve, or add a "
                    "fal-api-key Modal secret."
                ),
            },
        )

    body: dict[str, Any] = {**params}
    if not body.get("seed"):
        body.pop("seed", None)

    # Resolve image params if present
    use_edit = False
    async with httpx.AsyncClient(timeout=120) as client:
        if image_param and body.get(image_param):
            raw = body.pop(image_param)
            raw_values = (
                [raw]
                if isinstance(raw, str)
                else raw
                if isinstance(raw, list)
                else []
            )
            image_values = [
                value
                for value in raw_values
                if isinstance(value, str) and value
            ]
            if image_values:
                body["image_urls"] = [
                    await resolve_image(client, api_key, value)
                    for value in image_values
                ]
                use_edit = True

        actual_endpoint = (
            f"{endpoint}/edit" if use_edit else endpoint
        )
        res = await client.post(
            f"https://fal.run/{actual_endpoint}",
            headers={
                "Authorization": f"Key {api_key}",
                "Content-Type": "application/json",
            },
            json=body,
        )

    if not res.is_success:
        message = f"fal.ai error {res.status_code}"
        try:
            err = res.json()
            message = (
                err.get("detail") or err.get("message") or message
            )
        except Exception:
            pass
        return GenerateResult(
            status="failed",
            run_id="",
            error={"code": "FAL_ERROR", "message": message},
        )

    data = res.json()
    images = data.get("images", [])
    seed = data.get("seed")

    return GenerateResult(
        status="completed",
        run_id=uuid.uuid4().hex[:12],
        outputs=[
            OutputAsset(
                url=img["url"],
                type="image",
                format=img.get("content_type", "image/png")
                .split("/")[-1],
                metadata=(
                    {"seed": seed} if seed is not None else None
                ),
            )
            for img in images
        ],
    )
