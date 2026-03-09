"""Modal entry point — discovered by `modal serve` via the CLI."""

import modal

from lumen_sdk import app, registry
from lumen_sdk.web import AUTH_KEY_FILE, _CONTAINER_AUTH_KEY_FILE, create_app

registry.discover("pipelines")
serve_secrets = [
    modal.Secret.from_name(name)
    for name in registry.list_serve_secrets()
]

server_image = (
    modal.Image.debian_slim(python_version="3.12")
    .pip_install("fastapi>=0.115.0", "httpx>=0.28.0", "pydantic>=2.0.0")
    .add_local_file(AUTH_KEY_FILE, _CONTAINER_AUTH_KEY_FILE, copy=True)
    .add_local_python_source("pipelines")
    .add_local_python_source("lumen_sdk")
)


@app.function(image=server_image, secrets=serve_secrets)
@modal.asgi_app()
def serve():
    return create_app()
