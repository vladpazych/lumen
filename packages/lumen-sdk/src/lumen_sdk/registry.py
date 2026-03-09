"""Pipeline registry — maps pipeline IDs to their configs and generate functions."""

from __future__ import annotations

import importlib
import pkgutil
import sys
from collections.abc import Callable, Coroutine
from dataclasses import dataclass
from pathlib import Path
from typing import Any

from lumen_sdk.types import GenerateResult, PipelineConfig

GenerateFn = Callable[[dict[str, Any]], Coroutine[Any, Any, GenerateResult]]


@dataclass
class PipelineEntry:
    config: PipelineConfig
    generate: GenerateFn
    serve_secrets: tuple[str, ...] = ()


_registry: dict[str, PipelineEntry] = {}


def _parse_serve_secrets(
    value: object,
    *,
    module_name: str,
) -> tuple[str, ...]:
    if value is None:
        return ()
    if not isinstance(value, (list, tuple)):
        msg = (
            f"{module_name}.serve_secrets must be a list or tuple of "
            "Modal secret names"
        )
        raise TypeError(msg)

    secrets: list[str] = []
    for item in value:
        if not isinstance(item, str) or not item.strip():
            msg = (
                f"{module_name}.serve_secrets entries must be non-empty "
                "strings"
            )
            raise TypeError(msg)
        secrets.append(item.strip())
    return tuple(secrets)


def register(
    config: PipelineConfig,
    generate: GenerateFn,
    *,
    serve_secrets: tuple[str, ...] = (),
) -> None:
    _registry[config.id] = PipelineEntry(
        config=config,
        generate=generate,
        serve_secrets=serve_secrets,
    )


def get(pipeline_id: str) -> PipelineEntry | None:
    return _registry.get(pipeline_id)


def list_all() -> list[PipelineEntry]:
    return list(_registry.values())


def list_serve_secrets() -> list[str]:
    seen: set[str] = set()
    secrets: list[str] = []
    for entry in _registry.values():
        for secret in entry.serve_secrets:
            if secret in seen:
                continue
            seen.add(secret)
            secrets.append(secret)
    return secrets


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
        serve_secrets = _parse_serve_secrets(
            getattr(mod, "serve_secrets", None),
            module_name=f"{pkg_name}.{info.name}",
        )
        if isinstance(cfg, PipelineConfig) and callable(gen):
            register(cfg, gen, serve_secrets=serve_secrets)
