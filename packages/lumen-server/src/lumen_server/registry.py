"""Pipeline registry — maps pipeline IDs to their configs and generate functions."""

from __future__ import annotations

import importlib
import pkgutil
import sys
from collections.abc import Callable, Coroutine
from dataclasses import dataclass
from pathlib import Path
from typing import Any

from lumen_server.types import GenerateResult, PipelineConfig

GenerateFn = Callable[[dict[str, Any]], Coroutine[Any, Any, GenerateResult]]


@dataclass
class PipelineEntry:
    config: PipelineConfig
    generate: GenerateFn


_registry: dict[str, PipelineEntry] = {}


def register(config: PipelineConfig, generate: GenerateFn) -> None:
    _registry[config.id] = PipelineEntry(config=config, generate=generate)


def get(pipeline_id: str) -> PipelineEntry | None:
    return _registry.get(pipeline_id)


def list_all() -> list[PipelineEntry]:
    return list(_registry.values())


def discover(pipelines_dir: str = "pipelines") -> None:
    """Auto-import pipeline modules from a directory and register those with config + generate."""
    path = Path(pipelines_dir).resolve()
    if not path.is_dir():
        return

    # Ensure the pipelines directory is importable
    parent = str(path.parent)
    if parent not in sys.path:
        sys.path.insert(0, parent)

    pkg_name = path.name
    pkg = importlib.import_module(pkg_name)

    for info in pkgutil.iter_modules(pkg.__path__):
        if info.name.startswith("_"):
            continue
        mod = importlib.import_module(f"{pkg_name}.{info.name}")
        cfg = getattr(mod, "config", None)
        gen = getattr(mod, "generate", None)
        if isinstance(cfg, PipelineConfig) and callable(gen):
            register(cfg, gen)
