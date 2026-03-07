"""Lumen example inference server — FastAPI on Modal."""

from __future__ import annotations

import asyncio
import json
import os
import secrets
from pathlib import Path

import modal
from fastapi import FastAPI, Request
from fastapi.responses import JSONResponse
from starlette.responses import StreamingResponse

from pipelines import app, registry

registry.discover()

# --- Auth ---

AUTH_KEY_FILE = ".lumen/auth-key"
_CONTAINER_AUTH_KEY_FILE = "/run/auth-key"


def _ensure_auth_key() -> str:
    """Read auth key from container mount or generate locally if missing."""
    if os.path.exists(_CONTAINER_AUTH_KEY_FILE):
        return Path(_CONTAINER_AUTH_KEY_FILE).read_text().strip()
    path = Path(AUTH_KEY_FILE)
    if not path.exists():
        path.parent.mkdir(parents=True, exist_ok=True)
        path.write_text(secrets.token_urlsafe(32))
    return path.read_text().strip()


_auth_key = _ensure_auth_key()

# --- App ---

web_app = FastAPI(title="Lumen Example")


@web_app.middleware("http")
async def auth_middleware(request: Request, call_next):
    auth = request.headers.get("authorization", "")
    if not auth.startswith("Bearer ") or auth[7:] != _auth_key:
        return JSONResponse(
            status_code=401,
            content={"code": "UNAUTHORIZED", "message": "Invalid or missing auth key"},
        )
    return await call_next(request)


@web_app.get("/pipelines")
async def list_pipelines():
    return [e.config.to_manifest() for e in registry.list_all()]


@web_app.get("/pipelines/events")
async def pipeline_events():
    async def event_stream():
        configs = [e.config.to_wire() for e in registry.list_all()]
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
    return entry.config.to_wire()


@web_app.post("/pipelines/{pipeline_id}/generate")
async def generate(pipeline_id: str, params: dict | None = None):
    entry = registry.get(pipeline_id)
    if not entry:
        return JSONResponse(
            status_code=404,
            content={"code": "NOT_FOUND", "message": f"Pipeline not found: {pipeline_id}"},
        )
    result = await entry.generate(params or {})
    return result.to_wire()


# --- Modal ---

server_image = (
    modal.Image.debian_slim(python_version="3.12")
    .pip_install("fastapi>=0.115.0")
    .add_local_python_source("pipelines")
    .add_local_file(AUTH_KEY_FILE, _CONTAINER_AUTH_KEY_FILE)
)


@app.function(image=server_image)
@modal.asgi_app()
def serve():
    return web_app
