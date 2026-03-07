// Schema contract types shared between extension host and webview (no Zod — must serialize across postMessage)

// --- Parameter Definitions (discriminated union on `type`) ---

type BaseParam = {
  name: string
  label?: string
  required?: boolean
  group?: string
}

export type TextParam = BaseParam & {
  type: "text"
  default?: string
  multiline?: boolean
}

export type NumberParam = BaseParam & {
  type: "number"
  default?: number
  min?: number
  max?: number
  step?: number
}

export type IntegerParam = BaseParam & {
  type: "integer"
  default?: number
  min?: number
  max?: number
}

export type BooleanParam = BaseParam & {
  type: "boolean"
  default?: boolean
}

export type SelectOption = {
  value: string
  label?: string
}

export type SelectParam = BaseParam & {
  type: "select"
  options: SelectOption[]
  default?: string
}

export type SeedParam = BaseParam & {
  type: "seed"
  default?: number
}

export type DimensionPreset = {
  w: number
  h: number
  label: string
}

export type DimensionsParam = BaseParam & {
  type: "dimensions"
  default?: { w: number; h: number }
  presets?: DimensionPreset[]
}

export type ImageParam = BaseParam & { type: "image" }
export type VideoParam = BaseParam & { type: "video" }

export type PromptParam = BaseParam & {
  type: "prompt"
  default?: string
}

export type ParamDefinition =
  | TextParam
  | NumberParam
  | IntegerParam
  | BooleanParam
  | SelectParam
  | SeedParam
  | DimensionsParam
  | ImageParam
  | VideoParam
  | PromptParam

// --- Pipeline ---

export type PipelineCategory = "image" | "video"

export type PipelineManifest = {
  id: string
  name: string
  description?: string
  category: PipelineCategory
}

export type PipelineOutput = {
  type: "image" | "video" | "image[]" | "video[]"
  format?: string
}

export type PipelineConfig = {
  id: string
  name: string
  description?: string
  category: PipelineCategory
  params: ParamDefinition[]
  output: PipelineOutput
}

// --- Generation ---

export type OutputAsset = {
  url: string
  type: "image" | "video"
  format?: string
  metadata?: Record<string, unknown>
}

export type GenerateResponse =
  | { status: "completed"; runId: string; outputs: OutputAsset[] }
  | { status: "running"; runId: string; progress?: number }
  | { status: "queued"; runId: string }
  | { status: "failed"; runId: string; error: { code: string; message: string } }

// --- Configuration ---

/** A single config entry in the .imagic file — identified by stable UUID */
export type ImagicConfig = {
  id: string
  name?: string
  service: string
  pipeline: string
  params: Record<string, unknown>
}

// --- Server Status ---

export type ServerStatus = "connected" | "disconnected" | "error"

// --- Dev Server ---

export type DevServerState = "stopped" | "starting" | "running" | "error"
