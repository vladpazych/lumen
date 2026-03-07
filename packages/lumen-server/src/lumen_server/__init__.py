"""Lumen pipeline server framework — FastAPI on Modal."""

import modal

app = modal.App("lumen-server")

from lumen_server import registry  # noqa: E402
from lumen_server.types import *  # noqa: E402, F401, F403 — public API for pipeline authors
