"""Pipeline type definitions — Python-side mirror of the wire contract."""

from __future__ import annotations

from dataclasses import dataclass, field
from typing import Any, Literal


# --- Parameter definitions ---


@dataclass
class TextParam:
    type: Literal["text"] = "text"
    name: str = ""
    label: str | None = None
    required: bool | None = None
    group: str | None = None
    default: str | None = None
    multiline: bool | None = None


@dataclass
class NumberParam:
    type: Literal["number"] = "number"
    name: str = ""
    label: str | None = None
    required: bool | None = None
    group: str | None = None
    default: float | None = None
    min: float | None = None
    max: float | None = None
    step: float | None = None


@dataclass
class IntegerParam:
    type: Literal["integer"] = "integer"
    name: str = ""
    label: str | None = None
    required: bool | None = None
    group: str | None = None
    default: int | None = None
    min: int | None = None
    max: int | None = None


@dataclass
class BooleanParam:
    type: Literal["boolean"] = "boolean"
    name: str = ""
    label: str | None = None
    required: bool | None = None
    group: str | None = None
    default: bool | None = None


@dataclass
class SelectOption:
    value: str = ""
    label: str | None = None


@dataclass
class SelectParam:
    type: Literal["select"] = "select"
    name: str = ""
    label: str | None = None
    required: bool | None = None
    group: str | None = None
    options: list[SelectOption] = field(default_factory=list)
    default: str | None = None


@dataclass
class SeedParam:
    type: Literal["seed"] = "seed"
    name: str = ""
    label: str | None = None
    required: bool | None = None
    group: str | None = None
    default: int | None = None


@dataclass
class DimensionPreset:
    w: int = 0
    h: int = 0
    label: str = ""


@dataclass
class Dimensions:
    w: int = 0
    h: int = 0


@dataclass
class DimensionsParam:
    type: Literal["dimensions"] = "dimensions"
    name: str = ""
    label: str | None = None
    required: bool | None = None
    group: str | None = None
    default: Dimensions | None = None
    presets: list[DimensionPreset] | None = None


@dataclass
class ImageParam:
    type: Literal["image"] = "image"
    name: str = ""
    label: str | None = None
    required: bool | None = None
    group: str | None = None


@dataclass
class VideoParam:
    type: Literal["video"] = "video"
    name: str = ""
    label: str | None = None
    required: bool | None = None
    group: str | None = None


@dataclass
class PromptParam:
    type: Literal["prompt"] = "prompt"
    name: str = ""
    label: str | None = None
    required: bool | None = None
    group: str | None = None
    default: str | None = None


ParamDefinition = (
    TextParam
    | NumberParam
    | IntegerParam
    | BooleanParam
    | SelectParam
    | SeedParam
    | DimensionsParam
    | ImageParam
    | VideoParam
    | PromptParam
)


# --- Pipeline ---


@dataclass
class PipelineOutput:
    type: Literal["image", "video", "image[]", "video[]"] = "image"
    format: str | None = None


@dataclass
class PipelineManifest:
    id: str = ""
    name: str = ""
    description: str | None = None
    category: Literal["image", "video"] = "image"


@dataclass
class PipelineConfig:
    id: str = ""
    name: str = ""
    description: str | None = None
    category: Literal["image", "video"] = "image"
    params: list[ParamDefinition] = field(default_factory=list)
    output: PipelineOutput = field(default_factory=PipelineOutput)


# --- Generation ---


@dataclass
class OutputAsset:
    url: str = ""
    type: Literal["image", "video"] = "image"
    format: str | None = None
    metadata: dict[str, Any] | None = None


@dataclass
class GenerateResult:
    status: Literal["completed", "running", "queued", "failed"] = "completed"
    run_id: str = ""
    outputs: list[OutputAsset] = field(default_factory=list)
    progress: float | None = None
    error: dict[str, str] | None = None


def param_to_dict(p: ParamDefinition) -> dict[str, Any]:
    """Serialize a parameter definition to a JSON-compatible dict, omitting None values."""
    result: dict[str, Any] = {}
    for k, v in p.__dict__.items():
        if v is None:
            continue
        if isinstance(v, list):
            result[k] = [item.__dict__ if hasattr(item, "__dict__") else item for item in v]
        elif hasattr(v, "__dict__"):
            result[k] = v.__dict__
        else:
            result[k] = v
    return result


def config_to_dict(c: PipelineConfig) -> dict[str, Any]:
    """Serialize a pipeline config for the JSON response."""
    return {
        "id": c.id,
        "name": c.name,
        **({"description": c.description} if c.description else {}),
        "category": c.category,
        "params": [param_to_dict(p) for p in c.params],
        "output": {k: v for k, v in c.output.__dict__.items() if v is not None},
    }


def manifest_to_dict(c: PipelineConfig) -> dict[str, Any]:
    """Serialize a pipeline config as a manifest (no params/output)."""
    return {
        "id": c.id,
        "name": c.name,
        **({"description": c.description} if c.description else {}),
        "category": c.category,
    }


def result_to_dict(r: GenerateResult) -> dict[str, Any]:
    """Serialize a generate result for the JSON response."""
    d: dict[str, Any] = {"status": r.status, "runId": r.run_id}
    if r.status == "completed":
        d["outputs"] = [
            {k: v for k, v in o.__dict__.items() if v is not None} for o in r.outputs
        ]
    elif r.status == "running" and r.progress is not None:
        d["progress"] = r.progress
    elif r.status == "failed" and r.error:
        d["error"] = r.error
    return d
