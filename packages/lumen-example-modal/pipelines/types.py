"""Pipeline type definitions — Pydantic models matching the wire contract."""

from typing import Any, Literal

from pydantic import BaseModel, Field

# --- Parameter definitions ---


class TextParam(BaseModel):
    type: Literal["text"] = "text"
    name: str = ""
    label: str | None = None
    required: bool | None = None
    group: str | None = None
    default: str | None = None
    multiline: bool | None = None


class NumberParam(BaseModel):
    type: Literal["number"] = "number"
    name: str = ""
    label: str | None = None
    required: bool | None = None
    group: str | None = None
    default: float | None = None
    min: float | None = None
    max: float | None = None
    step: float | None = None


class IntegerParam(BaseModel):
    type: Literal["integer"] = "integer"
    name: str = ""
    label: str | None = None
    required: bool | None = None
    group: str | None = None
    default: int | None = None
    min: int | None = None
    max: int | None = None


class BooleanParam(BaseModel):
    type: Literal["boolean"] = "boolean"
    name: str = ""
    label: str | None = None
    required: bool | None = None
    group: str | None = None
    default: bool | None = None


class SelectOption(BaseModel):
    value: str = ""
    label: str | None = None


class SelectParam(BaseModel):
    type: Literal["select"] = "select"
    name: str = ""
    label: str | None = None
    required: bool | None = None
    group: str | None = None
    options: list[SelectOption] = []
    default: str | None = None


class SeedParam(BaseModel):
    type: Literal["seed"] = "seed"
    name: str = ""
    label: str | None = None
    required: bool | None = None
    group: str | None = None
    default: int | None = None


class DimensionPreset(BaseModel):
    w: int = 0
    h: int = 0
    label: str = ""


class Dimensions(BaseModel):
    w: int = 0
    h: int = 0


class DimensionsParam(BaseModel):
    type: Literal["dimensions"] = "dimensions"
    name: str = ""
    label: str | None = None
    required: bool | None = None
    group: str | None = None
    default: Dimensions | None = None
    presets: list[DimensionPreset] | None = None


class ImageParam(BaseModel):
    type: Literal["image"] = "image"
    name: str = ""
    label: str | None = None
    required: bool | None = None
    group: str | None = None


class VideoParam(BaseModel):
    type: Literal["video"] = "video"
    name: str = ""
    label: str | None = None
    required: bool | None = None
    group: str | None = None


class PromptParam(BaseModel):
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


class PipelineOutput(BaseModel):
    type: Literal["image", "video", "image[]", "video[]"] = "image"
    format: str | None = None


class PipelineConfig(BaseModel):
    id: str = ""
    name: str = ""
    description: str | None = None
    category: Literal["image", "video"] = "image"
    params: list[ParamDefinition] = []
    output: PipelineOutput = Field(default_factory=PipelineOutput)

    def to_wire(self) -> dict[str, Any]:
        """Full schema for GET /pipelines/{id} and SSE events."""
        return self.model_dump(exclude_none=True)

    def to_manifest(self) -> dict[str, Any]:
        """Lightweight listing for GET /pipelines."""
        return self.model_dump(
            include={"id", "name", "description", "category"}, exclude_none=True
        )


# --- Generation ---


class OutputAsset(BaseModel):
    url: str = ""
    type: Literal["image", "video"] = "image"
    format: str | None = None
    metadata: dict[str, Any] | None = None


class GenerateResult(BaseModel):
    status: Literal["completed", "running", "queued", "failed"] = "completed"
    run_id: str = ""
    outputs: list[OutputAsset] = []
    progress: float | None = None
    error: dict[str, str] | None = None

    def to_wire(self) -> dict[str, Any]:
        """Serialize for the JSON response. Uses camelCase runId."""
        d: dict[str, Any] = {"status": self.status, "runId": self.run_id}
        if self.status == "completed":
            d["outputs"] = [o.model_dump(exclude_none=True) for o in self.outputs]
        elif self.status == "running" and self.progress is not None:
            d["progress"] = self.progress
        elif self.status == "failed" and self.error:
            d["error"] = self.error
        return d


__all__ = [
    # Params
    "TextParam",
    "NumberParam",
    "IntegerParam",
    "BooleanParam",
    "SelectOption",
    "SelectParam",
    "SeedParam",
    "DimensionPreset",
    "Dimensions",
    "DimensionsParam",
    "ImageParam",
    "VideoParam",
    "PromptParam",
    "ParamDefinition",
    # Pipeline
    "PipelineOutput",
    "PipelineConfig",
    # Generation
    "OutputAsset",
    "GenerateResult",
]
