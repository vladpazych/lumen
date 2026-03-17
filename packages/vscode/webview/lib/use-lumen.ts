import { useCallback, useEffect, useReducer, useRef } from "react";
import type {
  LumenConfig,
  OutputAsset,
  PipelineConfig,
  ServerStatus,
} from "@vladpazych/lumen/types";
import { createConfig } from "@vladpazych/lumen/domain/config";
import type {
  DocumentKind,
  DevServerState,
  ExtensionMessage,
  ServerSetupInfo,
  WorkspaceAuthInfo,
  WorkspaceHomeInfo,
} from "./messaging";
import { vscode } from "./vscode";

/** Detect tqdm-style progress bars: `Loading weights:  10%|█ | 41/398` */
const PROGRESS_RE = /^(.*?)\d+%\|/;

type State = {
  documentKind: DocumentKind;
  schemas: Record<string, PipelineConfig[]>;
  configs: LumenConfig[];
  serverStatuses: Record<string, ServerStatus>;
  devServerState: DevServerState;
  devServerUrl: string | null;
  focusIndex: number;
  generating: Record<string, boolean>;
  progress: Record<string, number>;
  stage: Record<string, "queued" | "running">;
  results: Record<
    string,
    { outputs?: OutputAsset[]; error?: string }
  >;
  imageThumbs: Record<string, string>;
  devServerLog: string[];
  serverSetup: ServerSetupInfo;
  workspaceAuth: WorkspaceAuthInfo;
  workspaceHome: WorkspaceHomeInfo;
  installingServer: boolean;
  isPickingImage: boolean;
  ready: boolean;
};

type Action =
  | {
      type: "init";
      documentKind: DocumentKind;
      schemas: Record<string, PipelineConfig[]>;
      configs: LumenConfig[];
      serverStatuses: Record<string, ServerStatus>;
      devServerState: DevServerState;
      devServerUrl: string | null;
      serverSetup: ServerSetupInfo;
      workspaceAuth: WorkspaceAuthInfo;
      workspaceHome: WorkspaceHomeInfo;
    }
  | { type: "serverSetup"; setup: ServerSetupInfo }
  | { type: "workspaceAuth"; auth: WorkspaceAuthInfo }
  | { type: "workspaceHome"; home: WorkspaceHomeInfo }
  | { type: "configsUpdated"; configs: LumenConfig[] }
  | { type: "schemaRefresh"; serverUrl: string; pipelines: PipelineConfig[] }
  | { type: "serverStatus"; serverUrl: string; status: ServerStatus }
  | { type: "devServerStatus"; state: DevServerState }
  | { type: "updateParam"; configId: string; paramName: string; value: unknown }
  | { type: "addConfig"; config: LumenConfig }
  | { type: "removeConfig"; configId: string }
  | { type: "updateName"; configId: string; name: string }
  | { type: "setFocus"; index: number }
  | { type: "generateStart"; key: string }
  | {
      type: "generateProgress";
      key: string;
      progress: number;
      stage?: "queued" | "running";
    }
  | {
      type: "generateResult";
      key: string;
      outputs?: OutputAsset[];
      error?: string;
    }
  | { type: "pickImageStart" }
  | { type: "pickImageDone" }
  | { type: "installServerStart" }
  | { type: "mergeImageThumbs"; thumbs: Record<string, string> }
  | { type: "devServerLog"; text: string };

function reducer(state: State, action: Action): State {
  switch (action.type) {
    case "init":
      return {
        ...state,
        documentKind: action.documentKind,
        schemas: action.schemas,
        configs: action.configs,
        serverStatuses: action.serverStatuses,
        devServerState: action.devServerState,
        devServerUrl: action.devServerUrl,
        serverSetup: action.serverSetup,
        workspaceAuth: action.workspaceAuth,
        workspaceHome: action.workspaceHome,
        installingServer: false,
        ready: true,
      };
    case "serverSetup":
      return {
        ...state,
        serverSetup: action.setup,
        installingServer: false,
      };
    case "workspaceAuth":
      return {
        ...state,
        workspaceAuth: action.auth,
      };
    case "workspaceHome":
      return {
        ...state,
        workspaceHome: action.home,
      };
    case "configsUpdated":
      return { ...state, configs: action.configs };
    case "setFocus":
      return { ...state, focusIndex: action.index };
    case "schemaRefresh":
      return {
        ...state,
        schemas: { ...state.schemas, [action.serverUrl]: action.pipelines },
      };
    case "serverStatus":
      return {
        ...state,
        serverStatuses: {
          ...state.serverStatuses,
          [action.serverUrl]: action.status,
        },
      };
    case "devServerStatus": {
      const log = action.state === "starting" ? [] : state.devServerLog;
      return { ...state, devServerState: action.state, devServerLog: log };
    }
    case "updateParam": {
      const configs = state.configs.map((c) =>
        c.id === action.configId
          ? { ...c, params: { ...c.params, [action.paramName]: action.value } }
          : c,
      );
      return { ...state, configs };
    }
    case "addConfig":
      return { ...state, configs: [...state.configs, action.config] };
    case "removeConfig":
      return {
        ...state,
        configs: state.configs.filter((c) => c.id !== action.configId),
      };
    case "updateName": {
      const configs = state.configs.map((c) =>
        c.id === action.configId ? { ...c, name: action.name } : c,
      );
      return { ...state, configs };
    }
    case "generateStart": {
      const { [action.key]: _, ...restResults } = state.results;
      return {
        ...state,
        generating: { ...state.generating, [action.key]: true },
        progress: { ...state.progress, [action.key]: 0 },
        results: restResults,
      };
    }
    case "generateProgress":
      return {
        ...state,
        generating: { ...state.generating, [action.key]: true },
        progress: { ...state.progress, [action.key]: action.progress },
        stage: { ...state.stage, [action.key]: action.stage ?? "running" },
      };
    case "generateResult":
      return {
        ...state,
        generating: { ...state.generating, [action.key]: false },
        progress: { ...state.progress, [action.key]: 0 },
        results: {
          ...state.results,
          [action.key]: {
            outputs: action.outputs,
            error: action.error,
          },
        },
      };
    case "pickImageStart":
      return { ...state, isPickingImage: true };
    case "pickImageDone":
      return { ...state, isPickingImage: false };
    case "installServerStart":
      return { ...state, installingServer: true };
    case "mergeImageThumbs":
      return {
        ...state,
        imageThumbs: { ...state.imageThumbs, ...action.thumbs },
      };
    case "devServerLog": {
      const incoming = action.text.split("\n").filter((l) => l.trim() !== "");
      const lines = [...state.devServerLog];
      for (const line of incoming) {
        const match = line.match(PROGRESS_RE);
        if (match && lines.length > 0) {
          const prev = lines[lines.length - 1];
          const prevMatch = prev.match(PROGRESS_RE);
          if (prevMatch && prevMatch[1].trim() === match[1].trim()) {
            lines[lines.length - 1] = line;
            continue;
          }
        }
        lines.push(line);
      }
      return {
        ...state,
        devServerLog: lines.length > 200 ? lines.slice(-200) : lines,
      };
    }
  }
}

const initialState: State = {
  documentKind: "config",
  schemas: {},
  configs: [],
  serverStatuses: {},
  devServerState: "stopped",
  devServerUrl: null,
  focusIndex: 0,
  generating: {},
  progress: {},
  stage: {},
  results: {},
  imageThumbs: {},
  devServerLog: [],
  serverSetup: {
    serverPath: "",
    serverSetting: "server",
    installed: false,
    managed: false,
    authSecretName: "lumen-auth",
    manifest: null,
    pipelinePacks: [],
    skillPacks: [],
    canCreateModalSecret: false,
  },
  workspaceAuth: {
    modalCliInstalled: false,
    modalAuthenticated: false,
    lumenAuthTokenSaved: false,
    modalSecretName: "lumen-auth",
  },
  workspaceHome: {
    workspaceRoot: "",
    homePath: "",
    assetsPath: "",
    initialized: false,
    configFiles: [],
  },
  installingServer: false,
  isPickingImage: false,
  ready: false,
};

export function useLumen() {
  const [state, dispatch] = useReducer(reducer, initialState);
  const stateRef = useRef(state);

  useEffect(() => {
    stateRef.current = state;
  }, [state]);

  useEffect(() => {
    const handler = (event: MessageEvent<ExtensionMessage>) => {
      const msg = event.data;
      switch (msg.type) {
        case "init":
          dispatch({
            type: "init",
            documentKind: msg.documentKind,
            schemas: msg.schemas,
            configs: msg.configs,
            serverStatuses: msg.serverStatuses,
            devServerState: msg.devServerState,
            devServerUrl: msg.devServerUrl,
            serverSetup: msg.serverSetup,
            workspaceAuth: msg.workspaceAuth,
            workspaceHome: msg.workspaceHome,
          });
          break;
        case "serverSetup":
          dispatch({ type: "serverSetup", setup: msg.setup });
          break;
        case "workspaceAuth":
          dispatch({ type: "workspaceAuth", auth: msg.auth });
          break;
        case "workspaceHome":
          dispatch({ type: "workspaceHome", home: msg.home });
          break;
        case "configsUpdated":
          dispatch({ type: "configsUpdated", configs: msg.configs });
          break;
        case "schemaRefresh":
          dispatch({
            type: "schemaRefresh",
            serverUrl: msg.serverUrl,
            pipelines: msg.pipelines,
          });
          break;
        case "serverStatus":
          dispatch({
            type: "serverStatus",
            serverUrl: msg.serverUrl,
            status: msg.status,
          });
          break;
        case "devServerStatus":
          dispatch({ type: "devServerStatus", state: msg.state });
          break;
        case "devServerLog":
          dispatch({ type: "devServerLog", text: msg.text });
          break;
        case "generateProgress":
          dispatch({
            type: "generateProgress",
            key: msg.configId,
            progress: msg.progress,
            stage: msg.stage,
          });
          break;
        case "generateResult": {
          const key = msg.configId;
          if (msg.error) {
            dispatch({ type: "generateResult", key, error: msg.error });
          } else if (
            msg.response?.status === "completed" &&
            msg.response.outputs.length > 0
          ) {
            dispatch({
              type: "generateResult",
              key,
              outputs: msg.response.outputs,
            });
          } else if (msg.response?.status === "failed") {
            dispatch({
              type: "generateResult",
              key,
              error: msg.response.error.message,
            });
          } else {
            dispatch({
              type: "generateResult",
              key,
              error: "Unexpected response status",
            });
          }
          break;
        }
        case "imageThumbs":
          dispatch({ type: "mergeImageThumbs", thumbs: msg.thumbs });
          break;
        case "imagePicked": {
          dispatch({ type: "pickImageDone" });
          if (msg.url) {
            const currentState = stateRef.current;
            const config = currentState.configs.find((c) => c.id === msg.configId);
            const schema = currentState.schemas[msg.service]?.find(
              (pipeline) => pipeline.id === msg.pipeline,
            );
            const param = schema?.params.find((p) => p.name === msg.paramName);
            const isMulti =
              param?.type === "image" && (param.maxItems ?? 1) > 1;
            const existingValue =
              config?.params[msg.paramName];
            const nextValue = isMulti
              ? [
                  ...new Set([
                    ...(
                      Array.isArray(existingValue)
                        ? existingValue.filter(
                            (value): value is string => typeof value === "string",
                          )
                        : []
                    ),
                    msg.url,
                  ]),
                ].slice(0, param?.maxItems)
              : msg.url;
            dispatch({
              type: "updateParam",
              configId: msg.configId,
              paramName: msg.paramName,
              value: nextValue,
            });
            vscode.postMessage({
              type: "updateState",
              configId: msg.configId,
              service: msg.service,
              pipeline: msg.pipeline,
              paramName: msg.paramName,
              value: nextValue,
            });
            if (msg.thumbnailUri) {
              dispatch({
                type: "mergeImageThumbs",
                thumbs: { [msg.url]: msg.thumbnailUri },
              });
            }
          }
          break;
        }
      }
    };
    window.addEventListener("message", handler);
    vscode.postMessage({ type: "ready" });
    return () => window.removeEventListener("message", handler);
  }, []);

  const updateParam = useCallback(
    (
      configId: string,
      service: string,
      pipeline: string,
      paramName: string,
      value: unknown,
    ) => {
      dispatch({ type: "updateParam", configId, paramName, value });
      vscode.postMessage({
        type: "updateState",
        configId,
        service,
        pipeline,
        paramName,
        value,
      });
    },
    [],
  );

  const requestGenerate = useCallback(
    (
      configId: string,
      service: string,
      pipeline: string,
      params: Record<string, unknown>,
    ) => {
      const requestId = crypto.randomUUID();
      dispatch({ type: "generateStart", key: configId });
      vscode.postMessage({
        type: "generateRequest",
        requestId,
        configId,
        service,
        pipeline,
        params,
      });
    },
    [],
  );

  const setFocus = useCallback((index: number) => {
    dispatch({ type: "setFocus", index });
    vscode.postMessage({ type: "selectConfig", index });
  }, []);

  const refreshSchemas = useCallback(() => {
    vscode.postMessage({ type: "refreshSchemas" });
  }, []);

  const startDevServer = useCallback(() => {
    vscode.postMessage({ type: "startDevServer" });
  }, []);

  const stopDevServer = useCallback(() => {
    vscode.postMessage({ type: "stopDevServer" });
  }, []);

  const restartDevServer = useCallback(() => {
    vscode.postMessage({ type: "restartDevServer" });
  }, []);

  const installServer = useCallback(
    (serverSetting: string, pipelinePackIds: string[], skillPackIds: string[], initGit: boolean) => {
      dispatch({ type: "installServerStart" });
      vscode.postMessage({
        type: "installServer",
        serverSetting,
        pipelinePackIds,
        skillPackIds,
        initGit,
      });
    },
    [],
  );

  const copyServerAuthToken = useCallback(() => {
    vscode.postMessage({ type: "copyAuthToken" });
  }, []);

  const syncLumenAuthToModal = useCallback(() => {
    vscode.postMessage({ type: "syncLumenAuthToModal" });
  }, []);

  const openModalSettings = useCallback(() => {
    vscode.postMessage({ type: "openModalSettings" });
  }, []);

  const revealServer = useCallback(() => {
    vscode.postMessage({ type: "revealServer" });
  }, []);

  const initializeWorkspace = useCallback(() => {
    dispatch({ type: "installServerStart" });
    vscode.postMessage({ type: "initializeWorkspace" });
  }, []);

  const createRunnerConfig = useCallback(() => {
    vscode.postMessage({ type: "createRunnerConfig" });
  }, []);

  const openRunnerConfig = useCallback((uri: string) => {
    vscode.postMessage({ type: "openRunnerConfig", uri });
  }, []);

  const createPipeline = useCallback(() => {
    vscode.postMessage({ type: "createPipeline" });
  }, []);

  const updateRuntime = useCallback(() => {
    vscode.postMessage({ type: "updateRuntime" });
  }, []);

  const reinstallSkills = useCallback(() => {
    vscode.postMessage({ type: "reinstallSkills" });
  }, []);

  const revealAssets = useCallback(() => {
    vscode.postMessage({ type: "revealAssets" });
  }, []);

  const addConfig = useCallback(
    (
      service: string,
      pipeline: string,
      schemas: Record<string, PipelineConfig[]>,
      existingConfigs: LumenConfig[],
    ) => {
      const config = createConfig(service, pipeline, schemas, existingConfigs);
      dispatch({ type: "addConfig", config });
      vscode.postMessage({ type: "addConfig", config });
    },
    [],
  );

  const removeConfig = useCallback((configId: string) => {
    dispatch({ type: "removeConfig", configId });
    vscode.postMessage({ type: "removeConfig", configId });
  }, []);

  const updateName = useCallback((configId: string, name: string) => {
    dispatch({ type: "updateName", configId, name });
    vscode.postMessage({ type: "updateName", configId, name });
  }, []);

  const pickImage = useCallback(
    (
      configId: string,
      service: string,
      pipeline: string,
      paramName: string,
    ) => {
      dispatch({ type: "pickImageStart" });
      vscode.postMessage({
        type: "pickImage",
        requestId: crypto.randomUUID(),
        configId,
        service,
        pipeline,
        paramName,
      });
    },
    [],
  );

  const pickImageByUri = useCallback(
    (
      configId: string,
      service: string,
      pipeline: string,
      paramName: string,
      uri: string,
    ) => {
      dispatch({ type: "pickImageStart" });
      vscode.postMessage({
        type: "pickImageByUri",
        requestId: crypto.randomUUID(),
        configId,
        service,
        pipeline,
        paramName,
        uri,
      });
    },
    [],
  );

  return {
    ...state,
    addConfig,
    removeConfig,
    updateParam,
    updateName,
    setFocus,
    requestGenerate,
    refreshSchemas,
    startDevServer,
    stopDevServer,
    restartDevServer,
    installServer,
    copyServerAuthToken,
    syncLumenAuthToModal,
    openModalSettings,
    revealServer,
    initializeWorkspace,
    createRunnerConfig,
    openRunnerConfig,
    createPipeline,
    updateRuntime,
    reinstallSkills,
    revealAssets,
    pickImage,
    pickImageByUri,
  };
}
