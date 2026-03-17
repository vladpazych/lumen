from __future__ import annotations

import asyncio
import json
from typing import Any

from fastapi import FastAPI, Request
from fastapi.responses import JSONResponse
from starlette.responses import StreamingResponse

from lumen_server.auth import read_auth_token
from lumen_server import registry


def _unauthorized() -> JSONResponse:
    return JSONResponse(
        status_code=401,
        content={"code": "UNAUTHORIZED", "message": "Invalid or missing auth key"},
    )


def create_app() -> FastAPI:
    auth_token = read_auth_token()
    app = FastAPI(title="Lumen Pipeline Server")

    @app.middleware("http")
    async def auth_middleware(request: Request, call_next: Any) -> Any:
        auth_header = request.headers.get("authorization", "")
        if not auth_header.startswith("Bearer "):
            return _unauthorized()
        if auth_header[7:] != auth_token:
            return _unauthorized()
        return await call_next(request)

    @app.get("/pipelines")
    async def list_pipelines() -> Any:
        return [entry.config for entry in registry.list_all()]

    @app.get("/pipelines/events")
    async def pipeline_events() -> Any:
        async def event_stream() -> Any:
            configs = [entry.config for entry in registry.list_all()]
            yield f"event: schemas\ndata: {json.dumps(configs)}\n\n"
            try:
                while True:
                    await asyncio.sleep(15)
                    yield ": keepalive\n\n"
            except asyncio.CancelledError:
                return

        return StreamingResponse(event_stream(), media_type="text/event-stream")

    @app.get("/pipelines/{pipeline_id}")
    async def get_pipeline(pipeline_id: str) -> Any:
        entry = registry.get(pipeline_id)
        if entry is None:
            return JSONResponse(
                status_code=404,
                content={"code": "NOT_FOUND", "message": f"Pipeline not found: {pipeline_id}"},
            )
        return entry.config

    @app.post("/pipelines/{pipeline_id}/generate")
    async def generate(pipeline_id: str, params: dict[str, Any] | None = None) -> Any:
        entry = registry.get(pipeline_id)
        if entry is None:
            return JSONResponse(
                status_code=404,
                content={"code": "NOT_FOUND", "message": f"Pipeline not found: {pipeline_id}"},
            )

        try:
            return await registry.run_generate(entry, params or {})
        except Exception as exc:
            return {
                "status": "failed",
                "runId": "",
                "error": {"code": "INTERNAL_ERROR", "message": str(exc)},
            }

    return app
