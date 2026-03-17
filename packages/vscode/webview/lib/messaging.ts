import type {
  GenerateResponse,
  LumenConfig,
  PipelineConfig,
  ServerStatus,
} from "@vladpazych/lumen/types";

export type DevServerState =
  | "stopped"
  | "starting"
  | "rebuilding"
  | "running"
  | "stopping"
  | "orphaned"
  | "error";

export type PackInfo = {
  id: string;
  kind: "pipeline" | "skill";
  name: string;
  description: string;
};

export type DocumentKind = "workspace" | "config";

export type WorkspaceConfigFile = {
  name: string;
  path: string;
  relativePath: string;
  uri: string;
};

export type WorkspaceHomeInfo = {
  workspaceRoot: string;
  homePath: string;
  assetsPath: string;
  initialized: boolean;
  configFiles: WorkspaceConfigFile[];
};

export type ManagedServerManifest = {
  templateVersion: number;
  authSecretName: string;
  installedPipelinePacks: string[];
  installedSkillPacks: string[];
  initializedGit: boolean;
  createdAt: string;
};

export type ServerSetupInfo = {
  serverPath: string;
  serverSetting: string;
  installed: boolean;
  managed: boolean;
  authToken: string | null;
  authSecretName: string;
  manifest: ManagedServerManifest | null;
  pipelinePacks: PackInfo[];
  skillPacks: PackInfo[];
  canCreateModalSecret: boolean;
};

// --- Extension → Webview ---

export type InitMessage = {
  type: "init";
  documentKind: DocumentKind;
  schemas: Record<string, PipelineConfig[]>;
  configs: LumenConfig[];
  serverStatuses: Record<string, ServerStatus>;
  devServerState: DevServerState;
  devServerUrl: string | null;
  serverSetup: ServerSetupInfo;
  workspaceHome: WorkspaceHomeInfo;
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

export type DevServerLogMessage = {
  type: "devServerLog";
  text: string;
};

export type GenerateProgressMessage = {
  type: "generateProgress";
  requestId: string;
  configId: string;
  service: string;
  pipeline: string;
  progress: number;
  stage?: "queued" | "running";
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

export type ServerSetupMessage = {
  type: "serverSetup";
  setup: ServerSetupInfo;
};

export type WorkspaceHomeMessage = {
  type: "workspaceHome";
  home: WorkspaceHomeInfo;
};

export type ExtensionMessage =
  | InitMessage
  | ConfigsUpdatedMessage
  | GenerateResultMessage
  | GenerateProgressMessage
  | SchemaRefreshMessage
  | ServerStatusMessage
  | DevServerStatusMessage
  | DevServerLogMessage
  | ImagePickedMessage
  | ImageThumbsMessage
  | ServerSetupMessage
  | WorkspaceHomeMessage;

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
export type RestartDevServerMessage = { type: "restartDevServer" };

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

export type RemoveConfigMessage = {
  type: "removeConfig";
  configId: string;
};

export type InstallServerMessage = {
  type: "installServer";
  serverSetting: string;
  pipelinePackIds: string[];
  skillPackIds: string[];
  initGit: boolean;
};

export type InitializeWorkspaceMessage = {
  type: "initializeWorkspace";
};

export type CreateRunnerConfigMessage = {
  type: "createRunnerConfig";
};

export type OpenRunnerConfigMessage = {
  type: "openRunnerConfig";
  uri: string;
};

export type CreatePipelineMessage = {
  type: "createPipeline";
};

export type UpdateRuntimeMessage = {
  type: "updateRuntime";
};

export type ReinstallSkillsMessage = {
  type: "reinstallSkills";
};

export type CopyAuthTokenMessage = { type: "copyAuthToken" };
export type CreateModalSecretMessage = { type: "createModalSecret" };
export type RevealServerMessage = { type: "revealServer" };
export type RevealAssetsMessage = { type: "revealAssets" };

export type WebviewMessage =
  | ReadyMessage
  | UpdateStateMessage
  | GenerateRequestMessage
  | RefreshSchemasMessage
  | SelectConfigMessage
  | StartDevServerMessage
  | StopDevServerMessage
  | RestartDevServerMessage
  | PickImageMessage
  | PickImageByUriMessage
  | AddConfigMessage
  | UpdateNameMessage
  | RemoveConfigMessage
  | InstallServerMessage
  | InitializeWorkspaceMessage
  | CreateRunnerConfigMessage
  | OpenRunnerConfigMessage
  | CreatePipelineMessage
  | UpdateRuntimeMessage
  | ReinstallSkillsMessage
  | CopyAuthTokenMessage
  | CreateModalSecretMessage
  | RevealServerMessage
  | RevealAssetsMessage;
