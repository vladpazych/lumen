"""Lumen example inference server — FastAPI on Modal."""

from __future__ import annotations

import asyncio
import json

import modal
from fastapi import FastAPI
from fastapi.responses import JSONResponse
from starlette.responses import StreamingResponse

from pipelines import app, registry
from pipelines.types import config_to_dict, manifest_to_dict, result_to_dict

# Import pipelines to trigger registration
import pipelines.echo  # noqa: F401
import pipelines.z_image_turbo  # noqa: F401

web_app = FastAPI(title="Lumen Example")


@web_app.get("/pipelines")
async def list_pipelines():
    entries = registry.list_all()
    return [manifest_to_dict(e.config) for e in entries]


@web_app.get("/pipelines/events")
async def pipeline_events():
    async def event_stream():
        configs = [config_to_dict(e.config) for e in registry.list_all()]
        yield f"event: schemas\ndata: {json.dumps(configs)}\n\n"
        try:
            while True:
                await asyncio.sleep(15)
                yield ": keepalive\n\n"
        except asyncio.CancelledError:
            return

    return StreamingResponse(event_stream(), media_type="text/event-stream")


@web_app.get("/pipelines/{pipeline_id}")
async def get_pipeline(pipeline_id: str):
    entry = registry.get(pipeline_id)
    if not entry:
        return JSONResponse(
            status_code=404,
            content={"code": "NOT_FOUND", "message": f"Pipeline not found: {pipeline_id}"},
        )
    return config_to_dict(entry.config)


@web_app.post("/pipelines/{pipeline_id}/generate")
async def generate(pipeline_id: str, params: dict | None = None):
    entry = registry.get(pipeline_id)
    if not entry:
        return JSONResponse(
            status_code=404,
            content={"code": "NOT_FOUND", "message": f"Pipeline not found: {pipeline_id}"},
        )
    result = await entry.generate(params or {})
    return result_to_dict(result)


# --- Modal ---

server_image = (
    modal.Image.debian_slim(python_version="3.12")
    .pip_install("fastapi>=0.115.0")
    .add_local_python_source("pipelines")
)


@app.function(image=server_image)
@modal.asgi_app()
def serve():
    return web_app
