"""Pipeline registry — maps pipeline IDs to their configs and generate functions."""

from __future__ import annotations

from collections.abc import Callable, Coroutine
from dataclasses import dataclass
from typing import Any

from pipelines.types import GenerateResult, PipelineConfig

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


def discover() -> None:
    """Auto-import pipeline modules and register those with `config` + `generate`."""
    import importlib
    import pkgutil

    import pipelines as pkg

    for info in pkgutil.iter_modules(pkg.__path__):
        if info.name.startswith("_") or info.name in ("registry", "types"):
            continue
        mod = importlib.import_module(f"pipelines.{info.name}")
        cfg = getattr(mod, "config", None)
        gen = getattr(mod, "generate", None)
        if isinstance(cfg, PipelineConfig) and callable(gen):
            register(cfg, gen)
