import type {
  DevServerState,
  GenerateResponse,
  LumenConfig,
  PipelineConfig,
  ServerStatus,
} from "../../shared/types";

// --- Extension → Webview ---

export type InitMessage = {
  type: "init";
  schemas: Record<string, PipelineConfig[]>;
  configs: LumenConfig[];
  serverStatuses: Record<string, ServerStatus>;
  serverNames: Record<string, string>;
  devServerState: DevServerState;
  devServerUrl: string | null;
};

export type ConfigsUpdatedMessage = {
  type: "configsUpdated";
  configs: LumenConfig[];
};

export type GenerateResultMessage = {
  type: "generateResult";
  requestId: string;
  configId: string;
  service: string;
  pipeline: string;
  response?: GenerateResponse;
  error?: string;
};

export type SchemaRefreshMessage = {
  type: "schemaRefresh";
  serverUrl: string;
  pipelines: PipelineConfig[];
};

export type ServerStatusMessage = {
  type: "serverStatus";
  serverUrl: string;
  status: ServerStatus;
};

export type DevServerStatusMessage = {
  type: "devServerStatus";
  state: DevServerState;
};

export type GenerateProgressMessage = {
  type: "generateProgress";
  requestId: string;
  configId: string;
  service: string;
  pipeline: string;
  progress: number;
};

export type ImagePickedMessage = {
  type: "imagePicked";
  requestId: string;
  configId: string;
  service: string;
  pipeline: string;
  paramName: string;
  url?: string;
  thumbnailUri?: string;
  error?: string;
};

export type ImageThumbsMessage = {
  type: "imageThumbs";
  thumbs: Record<string, string>;
};

export type ExtensionMessage =
  | InitMessage
  | ConfigsUpdatedMessage
  | GenerateResultMessage
  | GenerateProgressMessage
  | SchemaRefreshMessage
  | ServerStatusMessage
  | DevServerStatusMessage
  | ImagePickedMessage
  | ImageThumbsMessage;

// --- Webview → Extension ---

export type ReadyMessage = { type: "ready" };

export type UpdateStateMessage = {
  type: "updateState";
  configId: string;
  service: string;
  pipeline: string;
  paramName: string;
  value: unknown;
};

export type GenerateRequestMessage = {
  type: "generateRequest";
  requestId: string;
  configId: string;
  service: string;
  pipeline: string;
  params: Record<string, unknown>;
};

export type RefreshSchemasMessage = { type: "refreshSchemas" };

export type SelectConfigMessage = {
  type: "selectConfig";
  index: number;
};

export type StartDevServerMessage = { type: "startDevServer" };
export type StopDevServerMessage = { type: "stopDevServer" };

export type PickImageMessage = {
  type: "pickImage";
  requestId: string;
  configId: string;
  service: string;
  pipeline: string;
  paramName: string;
};

export type PickImageByUriMessage = {
  type: "pickImageByUri";
  requestId: string;
  configId: string;
  service: string;
  pipeline: string;
  paramName: string;
  uri: string;
};

export type AddConfigMessage = {
  type: "addConfig";
  config: LumenConfig;
};

export type UpdateNameMessage = {
  type: "updateName";
  configId: string;
  name: string;
};

export type WebviewMessage =
  | ReadyMessage
  | UpdateStateMessage
  | GenerateRequestMessage
  | RefreshSchemasMessage
  | SelectConfigMessage
  | StartDevServerMessage
  | StopDevServerMessage
  | PickImageMessage
  | PickImageByUriMessage
  | AddConfigMessage
  | UpdateNameMessage;
