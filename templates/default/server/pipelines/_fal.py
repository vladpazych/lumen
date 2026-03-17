"""Shared fal.ai API helper — not a pipeline (skipped by discovery)."""

from __future__ import annotations

import base64
import os
import uuid
from typing import Any

import httpx

ASPECT_RATIO_OPTIONS = [
    {"value": "1:1", "label": "1:1 Square"},
    {"value": "16:9", "label": "16:9 Landscape"},
    {"value": "9:16", "label": "9:16 Portrait"},
    {"value": "4:3", "label": "4:3"},
    {"value": "3:4", "label": "3:4"},
    {"value": "3:2", "label": "3:2"},
    {"value": "2:3", "label": "2:3"},
    {"value": "4:5", "label": "4:5"},
    {"value": "5:4", "label": "5:4"},
    {"value": "21:9", "label": "21:9 Ultrawide"},
]

FORMAT_OPTIONS = [
    {"value": "png", "label": "PNG"},
    {"value": "jpeg", "label": "JPEG"},
    {"value": "webp", "label": "WebP"},
]


def shared_params(
    resolution_options: list[dict[str, str]],
) -> list[dict[str, Any]]:
    return [
        {
            "type": "select",
            "name": "aspect_ratio",
            "label": "Aspect Ratio",
            "default": "1:1",
            "options": ASPECT_RATIO_OPTIONS,
            "group": "basic",
        },
        {
            "type": "integer",
            "name": "num_images",
            "label": "Images",
            "default": 1,
            "min": 1,
            "max": 4,
            "group": "basic",
        },
        {"type": "seed", "name": "seed", "label": "Seed", "group": "advanced"},
        {
            "type": "select",
            "name": "output_format",
            "label": "Format",
            "default": "png",
            "options": FORMAT_OPTIONS,
            "display": "toggle",
            "group": "advanced",
        },
        {
            "type": "select",
            "name": "resolution",
            "label": "Resolution",
            "default": "1K",
            "options": resolution_options,
            "group": "advanced",
        },
        {
            "type": "boolean",
            "name": "enable_web_search",
            "label": "Web Search",
            "default": False,
            "group": "advanced",
        },
    ]


def _get_api_key() -> str | None:
    return os.environ.get("FAL_KEY")


async def _upload_to_fal_cdn(
    client: httpx.AsyncClient,
    api_key: str,
    image_bytes: bytes,
    content_type: str,
) -> str:
    init = await client.post(
        "https://rest.fal.ai/storage/upload/initiate?storage_type=fal-cdn-v3",
        headers={
            "Authorization": f"Key {api_key}",
            "Content-Type": "application/json",
        },
        json={"content_type": content_type, "file_name": "image.png"},
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
    if value.startswith("http"):
        return value
    if value.startswith("data:"):
        header, b64data = value.split(",", 1)
        content_type = header.split(":")[1].split(";")[0]
        image_bytes = base64.b64decode(b64data)
        return await _upload_to_fal_cdn(client, api_key, image_bytes, content_type)
    raise ValueError(f"Cannot resolve image on server: {value}")


async def run_fal(
    endpoint: str,
    params: dict[str, Any],
    *,
    image_param: str | None = None,
) -> dict[str, Any]:
    api_key = _get_api_key()
    if not api_key:
        return {
            "status": "failed",
            "runId": "",
            "error": {
                "code": "MISSING_API_KEY",
                "message": (
                    "FAL_KEY not set. Export FAL_KEY=your-key before running modal serve, "
                    "or add a fal-api-key Modal secret."
                ),
            },
        }

    body: dict[str, Any] = {**params}
    if not body.get("seed"):
        body.pop("seed", None)

    use_edit = False
    async with httpx.AsyncClient(timeout=120) as client:
        if image_param and body.get(image_param):
            raw = body.pop(image_param)
            raw_values = [raw] if isinstance(raw, str) else raw if isinstance(raw, list) else []
            image_values = [value for value in raw_values if isinstance(value, str) and value]
            if image_values:
                body["image_urls"] = [
                    await resolve_image(client, api_key, value) for value in image_values
                ]
                use_edit = True

        actual_endpoint = f"{endpoint}/edit" if use_edit else endpoint
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
            message = err.get("detail") or err.get("message") or message
        except Exception:
            pass
        return {
            "status": "failed",
            "runId": "",
            "error": {"code": "FAL_ERROR", "message": message},
        }

    data = res.json()
    images = data.get("images", [])
    seed = data.get("seed")

    return {
        "status": "completed",
        "runId": uuid.uuid4().hex[:12],
        "outputs": [
            {
                "url": image["url"],
                "type": "image",
                "format": image.get("content_type", "image/png").split("/")[-1],
                "metadata": {"seed": seed} if seed is not None else None,
            }
            for image in images
        ],
    }
