"""Modal entry point — discovered by `modal serve` via the CLI."""

import modal

from lumen_server import app, registry
from lumen_server.web import AUTH_KEY_FILE, _CONTAINER_AUTH_KEY_FILE, create_app

registry.discover("pipelines")

server_image = (
    modal.Image.debian_slim(python_version="3.12")
    .pip_install("fastapi>=0.115.0", "httpx>=0.28.0", "pydantic>=2.0.0")
    .add_local_file(AUTH_KEY_FILE, _CONTAINER_AUTH_KEY_FILE, copy=True)
    .add_local_python_source("pipelines")
    .add_local_python_source("lumen_server")
)


@app.function(image=server_image)
@modal.asgi_app()
def serve():
    return create_app()
