"""Imagic inference server — FastAPI on Modal."""

from __future__ import annotations

import modal
from fastapi import FastAPI
from fastapi.responses import JSONResponse

from pipelines import app, registry
from pipelines.types import config_to_dict, manifest_to_dict, result_to_dict

# Import pipelines to trigger registration
import pipelines.echo  # noqa: F401
import pipelines.txt2img  # noqa: F401
import pipelines.flux_uncensored  # noqa: F401
import pipelines.flux_realism  # noqa: F401

web_app = FastAPI(title="Imagic")


@web_app.get("/pipelines")
async def list_pipelines():
    entries = registry.list_all()
    return [manifest_to_dict(e.config) for e in entries]


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


@web_app.get("/pipelines/{pipeline_id}/runs/{run_id}")
async def get_run(pipeline_id: str, run_id: str):
    progress_dict = modal.Dict.from_name("imagic-progress", create_if_missing=True)
    try:
        data = await progress_dict.get.aio(run_id)
    except KeyError:
        return JSONResponse(
            status_code=404,
            content={"code": "NOT_FOUND", "message": f"Run not found: {run_id}"},
        )

    status = data.get("status", "running")

    if status == "completed":
        metadata = data.get("metadata", {})
        return {
            "status": "completed",
            "runId": run_id,
            "outputs": [
                {
                    "url": data["data_url"],
                    "type": "image",
                    "format": "png",
                    **({"metadata": metadata} if metadata else {}),
                }
            ],
        }

    if status == "failed":
        return {"status": "failed", "runId": run_id, "error": data.get("error", {})}

    # running or queued
    step = data.get("step", 0)
    total = data.get("total_steps", 1)
    progress = step / total if total > 0 else 0
    return {"status": status, "runId": run_id, "progress": progress}


# --- Modal ---

server_image = (
    modal.Image.debian_slim(python_version="3.12")
    .pip_install("fastapi>=0.115.0", "Pillow>=10.0.0")
    .add_local_python_source("pipelines")
)


@app.function(image=server_image)
@modal.asgi_app()
def serve():
    return web_app
