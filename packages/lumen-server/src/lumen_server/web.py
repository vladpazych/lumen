"""FastAPI app factory — creates the web app with pipeline routes and auth."""

from __future__ import annotations

import asyncio
import json
from pathlib import Path
from typing import Any

from fastapi import FastAPI, Request
from fastapi.responses import JSONResponse
from starlette.responses import StreamingResponse

from lumen_server import registry
from lumen_server.types import GenerateResult

AUTH_KEY_FILE = ".authkey"
_CONTAINER_AUTH_KEY_FILE = "/run/authkey"


def _read_auth_key() -> str:
    """Read auth key from container mount or local file. Extension generates the key."""
    for path in [_CONTAINER_AUTH_KEY_FILE, AUTH_KEY_FILE]:
        p = Path(path)
        if p.exists():
            return p.read_text().strip()
    raise RuntimeError(f"Auth key not found at {AUTH_KEY_FILE} — extension must generate it")


def create_app() -> FastAPI:
    """Create the FastAPI app with pipeline routes and auth middleware."""
    auth_key = _read_auth_key()
    web_app = FastAPI(title="Lumen Server")

    @web_app.middleware("http")
    async def auth_middleware(request: Request, call_next: Any) -> Any:
        auth = request.headers.get("authorization", "")
        if not auth.startswith("Bearer ") or auth[7:] != auth_key:
            return JSONResponse(
                status_code=401,
                content={"code": "UNAUTHORIZED", "message": "Invalid or missing auth key"},
            )
        return await call_next(request)

    @web_app.get("/pipelines")
    async def list_pipelines() -> Any:
        return [e.config.to_wire() for e in registry.list_all()]

    @web_app.get("/pipelines/events")
    async def pipeline_events() -> Any:
        async def event_stream() -> Any:
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
    async def get_pipeline(pipeline_id: str) -> Any:
        entry = registry.get(pipeline_id)
        if not entry:
            return JSONResponse(
                status_code=404,
                content={"code": "NOT_FOUND", "message": f"Pipeline not found: {pipeline_id}"},
            )
        return entry.config.to_wire()

    @web_app.post("/pipelines/{pipeline_id}/generate")
    async def generate(pipeline_id: str, params: dict | None = None) -> Any:
        entry = registry.get(pipeline_id)
        if not entry:
            return JSONResponse(
                status_code=404,
                content={"code": "NOT_FOUND", "message": f"Pipeline not found: {pipeline_id}"},
            )
        try:
            result = await entry.generate(params or {})
        except Exception as exc:
            result = GenerateResult(
                status="failed",
                run_id="",
                error={"code": "INTERNAL_ERROR", "message": str(exc)},
            )
        return result.to_wire()

    return web_app
