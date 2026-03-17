"""Modal entry point — discovered by `modal serve`."""

from __future__ import annotations

import modal

from lumen_server import registry
from lumen_server.auth import AUTH_KEY_FILE
from lumen_server.modal_app import app
from lumen_server.web import create_app

registry.discover("pipelines")

server_image = (
    modal.Image.debian_slim(python_version="3.12")
    .pip_install("fastapi>=0.115.0", "httpx>=0.28.0")
    .add_local_file(AUTH_KEY_FILE, "/root/.authkey", copy=True)
    .add_local_python_source("lumen_server")
    .add_local_python_source("pipelines")
)
serve_secrets = [
    modal.Secret.from_name(name) for name in registry.list_serve_secrets()
]


@app.function(image=server_image, secrets=serve_secrets)
@modal.asgi_app()
def serve():
    return create_app()
