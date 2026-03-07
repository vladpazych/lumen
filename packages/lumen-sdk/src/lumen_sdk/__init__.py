"""Lumen pipeline server framework — FastAPI on Modal."""

import modal

app = modal.App("lumen")

from lumen_sdk import registry  # noqa: E402
from lumen_sdk.types import *  # noqa: E402, F401, F403 — public API for pipeline authors
