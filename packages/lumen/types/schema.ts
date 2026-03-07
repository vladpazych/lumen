// Pipeline schema: the "schema for schema" — defines what UI renders

type BaseParam = {
  name: string;
  label?: string;
  required?: boolean;
  group?: string;
};

export type TextParam = BaseParam & {
  type: "text";
  default?: string;
  multiline?: boolean;
};

export type NumberParam = BaseParam & {
  type: "number";
  default?: number;
  min?: number;
  max?: number;
  step?: number;
};

export type IntegerParam = BaseParam & {
  type: "integer";
  default?: number;
  min?: number;
  max?: number;
};

export type BooleanParam = BaseParam & {
  type: "boolean";
  default?: boolean;
};

export type SelectOption = {
  value: string;
  label?: string;
};

export type SelectParam = BaseParam & {
  type: "select";
  options: SelectOption[];
  default?: string;
};

export type SeedParam = BaseParam & {
  type: "seed";
  default?: number;
};

export type DimensionPreset = {
  w: number;
  h: number;
  label: string;
};

export type DimensionsParam = BaseParam & {
  type: "dimensions";
  default?: { w: number; h: number };
  presets?: DimensionPreset[];
};

export type ImageParam = BaseParam & { type: "image" };
export type VideoParam = BaseParam & { type: "video" };

export type PromptParam = BaseParam & {
  type: "prompt";
  default?: string;
};

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
  | PromptParam;

export type PipelineCategory = "image" | "video";

export type PipelineManifest = {
  id: string;
  name: string;
  description?: string;
  category: PipelineCategory;
};

export type PipelineOutput = {
  type: "image" | "video" | "image[]" | "video[]";
  format?: string;
};

export type PipelineConfig = {
  id: string;
  name: string;
  description?: string;
  category: PipelineCategory;
  params: ParamDefinition[];
  output: PipelineOutput;
};
