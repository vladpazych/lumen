from __future__ import annotations

from dataclasses import dataclass
import importlib
from inspect import isawaitable
from pathlib import Path
import sys
from typing import Any, Awaitable, Callable


GenerateFn = Callable[[dict[str, Any]], Awaitable[dict[str, Any]] | dict[str, Any]]


@dataclass(frozen=True)
class PipelineEntry:
    config: dict[str, Any]
    generate: GenerateFn
    serve_secrets: tuple[str, ...] = ()


_entries: dict[str, PipelineEntry] = {}


def _validate_config(module_name: str, value: Any) -> dict[str, Any]:
    if not isinstance(value, dict):
        raise TypeError(f"{module_name}.config must be a dict")

    pipeline_id = value.get("id")
    if not isinstance(pipeline_id, str) or pipeline_id.strip() == "":
        raise TypeError(f"{module_name}.config['id'] must be a non-empty string")

    params = value.get("params")
    if not isinstance(params, list):
        raise TypeError(f"{module_name}.config['params'] must be a list")

    output = value.get("output")
    if not isinstance(output, dict):
        raise TypeError(f"{module_name}.config['output'] must be a dict")

    return value


def _validate_secrets(module_name: str, value: Any) -> tuple[str, ...]:
    if value is None:
        return ()
    if not isinstance(value, (list, tuple)):
        raise TypeError(f"{module_name}.serve_secrets must be a list or tuple")

    secrets: list[str] = []
    for item in value:
        if not isinstance(item, str) or item.strip() == "":
            raise TypeError(
                f"{module_name}.serve_secrets entries must be non-empty strings"
            )
        secrets.append(item.strip())
    return tuple(secrets)


def discover(pipelines_dir: str = "pipelines") -> None:
    _entries.clear()

    root = Path(pipelines_dir).resolve()
    if not root.exists():
        return

    package_name = root.name
    package_parent = str(root.parent)
    if package_parent not in sys.path:
        sys.path.insert(0, package_parent)

    importlib.invalidate_caches()

    for file_path in sorted(root.glob("*.py")):
        if file_path.name.startswith("_"):
            continue

        module_name = f"{package_name}.{file_path.stem}"
        sys.modules.pop(module_name, None)
        module = importlib.import_module(module_name)

        config = _validate_config(module_name, getattr(module, "config", None))
        generate = getattr(module, "generate", None)
        if not callable(generate):
            raise TypeError(f"{module_name}.generate must be callable")

        pipeline_id = config["id"]
        if pipeline_id in _entries:
            raise ValueError(f"Duplicate pipeline id: {pipeline_id}")

        _entries[pipeline_id] = PipelineEntry(
            config=config,
            generate=generate,
            serve_secrets=_validate_secrets(
                module_name, getattr(module, "serve_secrets", None)
            ),
        )


def list_all() -> list[PipelineEntry]:
    return list(_entries.values())


def get(pipeline_id: str) -> PipelineEntry | None:
    return _entries.get(pipeline_id)


def list_serve_secrets() -> list[str]:
    seen: set[str] = set()
    ordered: list[str] = []
    for entry in _entries.values():
        for secret in entry.serve_secrets:
            if secret in seen:
                continue
            seen.add(secret)
            ordered.append(secret)
    return ordered


async def run_generate(entry: PipelineEntry, params: dict[str, Any]) -> dict[str, Any]:
    result = entry.generate(params)
    if isawaitable(result):
        return await result
    return result
