"""Pipeline registry — maps pipeline IDs to their configs and generate functions."""

from __future__ import annotations

from dataclasses import dataclass, field
from typing import Any, Callable, Coroutine

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
