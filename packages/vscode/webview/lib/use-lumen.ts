import { useCallback, useEffect, useReducer } from "react"
import type { DevServerState, LumenConfig, PipelineConfig, ServerStatus } from "../../shared/types"
import type { ExtensionMessage } from "./messaging"
import { vscode } from "./vscode"

type State = {
  schemas: Record<string, PipelineConfig[]>
  configs: LumenConfig[]
  serverStatuses: Record<string, ServerStatus>
  devServerState: DevServerState
  devServerUrl: string | null
  focusIndex: number
  generating: Record<string, boolean>
  progress: Record<string, number>
  results: Record<string, { imageUrl?: string; error?: string; metadata?: Record<string, unknown> }>
  imageThumbs: Record<string, string>
  isPickingImage: boolean
  ready: boolean
}

type Action =
  | {
      type: "init"
      schemas: Record<string, PipelineConfig[]>
      configs: LumenConfig[]
      serverStatuses: Record<string, ServerStatus>
      devServerState: DevServerState
      devServerUrl: string | null
    }
  | { type: "configsUpdated"; configs: LumenConfig[] }
  | { type: "schemaRefresh"; serverUrl: string; pipelines: PipelineConfig[] }
  | { type: "serverStatus"; serverUrl: string; status: ServerStatus }
  | { type: "devServerStatus"; state: DevServerState }
  | { type: "updateParam"; configId: string; paramName: string; value: unknown }
  | { type: "addConfig"; config: LumenConfig }
  | { type: "updateName"; configId: string; name: string }
  | { type: "setFocus"; index: number }
  | { type: "generateStart"; key: string }
  | { type: "generateProgress"; key: string; progress: number }
  | { type: "generateResult"; key: string; imageUrl?: string; error?: string; metadata?: Record<string, unknown> }
  | { type: "pickImageStart" }
  | { type: "pickImageDone" }
  | { type: "mergeImageThumbs"; thumbs: Record<string, string> }

function reducer(state: State, action: Action): State {
  switch (action.type) {
    case "init":
      return {
        ...state,
        schemas: action.schemas,
        configs: action.configs,
        serverStatuses: action.serverStatuses,
        devServerState: action.devServerState,
        devServerUrl: action.devServerUrl,
        ready: true,
      }
    case "configsUpdated":
      return { ...state, configs: action.configs }
    case "setFocus":
      return { ...state, focusIndex: action.index }
    case "schemaRefresh":
      return { ...state, schemas: { ...state.schemas, [action.serverUrl]: action.pipelines } }
    case "serverStatus":
      return { ...state, serverStatuses: { ...state.serverStatuses, [action.serverUrl]: action.status } }
    case "devServerStatus":
      return { ...state, devServerState: action.state }
    case "updateParam": {
      const configs = state.configs.map((c) =>
        c.id === action.configId ? { ...c, params: { ...c.params, [action.paramName]: action.value } } : c,
      )
      return { ...state, configs }
    }
    case "addConfig":
      return { ...state, configs: [...state.configs, action.config] }
    case "updateName": {
      const configs = state.configs.map((c) => (c.id === action.configId ? { ...c, name: action.name } : c))
      return { ...state, configs }
    }
    case "generateStart":
      return {
        ...state,
        generating: { ...state.generating, [action.key]: true },
        progress: { ...state.progress, [action.key]: 0 },
      }
    case "generateProgress":
      return { ...state, progress: { ...state.progress, [action.key]: action.progress } }
    case "generateResult":
      return {
        ...state,
        generating: { ...state.generating, [action.key]: false },
        progress: { ...state.progress, [action.key]: 0 },
        results: {
          ...state.results,
          [action.key]: { imageUrl: action.imageUrl, error: action.error, metadata: action.metadata },
        },
      }
    case "pickImageStart":
      return { ...state, isPickingImage: true }
    case "pickImageDone":
      return { ...state, isPickingImage: false }
    case "mergeImageThumbs":
      return { ...state, imageThumbs: { ...state.imageThumbs, ...action.thumbs } }
  }
}

const initialState: State = {
  schemas: {},
  configs: [],
  serverStatuses: {},
  devServerState: "stopped",
  devServerUrl: null,
  focusIndex: 0,
  generating: {},
  progress: {},
  results: {},
  imageThumbs: {},
  isPickingImage: false,
  ready: false,
}

export function useLumen() {
  const [state, dispatch] = useReducer(reducer, initialState)

  useEffect(() => {
    const handler = (event: MessageEvent<ExtensionMessage>) => {
      const msg = event.data
      switch (msg.type) {
        case "init":
          dispatch({
            type: "init",
            schemas: msg.schemas,
            configs: msg.configs,
            serverStatuses: msg.serverStatuses,
            devServerState: msg.devServerState,
            devServerUrl: msg.devServerUrl,
          })
          break
        case "configsUpdated":
          dispatch({ type: "configsUpdated", configs: msg.configs })
          break
        case "schemaRefresh":
          dispatch({ type: "schemaRefresh", serverUrl: msg.serverUrl, pipelines: msg.pipelines })
          break
        case "serverStatus":
          dispatch({ type: "serverStatus", serverUrl: msg.serverUrl, status: msg.status })
          break
        case "devServerStatus":
          dispatch({ type: "devServerStatus", state: msg.state })
          break
        case "generateProgress":
          dispatch({ type: "generateProgress", key: msg.configId, progress: msg.progress })
          break
        case "generateResult": {
          const key = msg.configId
          if (msg.error) {
            dispatch({ type: "generateResult", key, error: msg.error })
          } else if (msg.response?.status === "completed" && msg.response.outputs.length > 0) {
            const output = msg.response.outputs[0]
            dispatch({ type: "generateResult", key, imageUrl: output.url, metadata: output.metadata })
          } else if (msg.response?.status === "failed") {
            dispatch({ type: "generateResult", key, error: msg.response.error.message })
          } else {
            dispatch({ type: "generateResult", key, error: "Unexpected response status" })
          }
          break
        }
        case "imageThumbs":
          dispatch({ type: "mergeImageThumbs", thumbs: msg.thumbs })
          break
        case "imagePicked": {
          dispatch({ type: "pickImageDone" })
          if (msg.url) {
            dispatch({ type: "updateParam", configId: msg.configId, paramName: msg.paramName, value: msg.url })
            vscode.postMessage({
              type: "updateState",
              configId: msg.configId,
              service: msg.service,
              pipeline: msg.pipeline,
              paramName: msg.paramName,
              value: msg.url,
            })
            if (msg.thumbnailUri) {
              dispatch({ type: "mergeImageThumbs", thumbs: { [msg.url]: msg.thumbnailUri } })
            }
          }
          break
        }
      }
    }
    window.addEventListener("message", handler)
    vscode.postMessage({ type: "ready" })
    return () => window.removeEventListener("message", handler)
  }, [])

  const updateParam = useCallback(
    (configId: string, service: string, pipeline: string, paramName: string, value: unknown) => {
      dispatch({ type: "updateParam", configId, paramName, value })
      vscode.postMessage({ type: "updateState", configId, service, pipeline, paramName, value })
    },
    [],
  )

  const requestGenerate = useCallback(
    (configId: string, service: string, pipeline: string, params: Record<string, unknown>) => {
      const requestId = crypto.randomUUID()
      dispatch({ type: "generateStart", key: configId })
      vscode.postMessage({ type: "generateRequest", requestId, configId, service, pipeline, params })
    },
    [],
  )

  const setFocus = useCallback((index: number) => {
    dispatch({ type: "setFocus", index })
    vscode.postMessage({ type: "selectConfig", index })
  }, [])

  const refreshSchemas = useCallback(() => {
    vscode.postMessage({ type: "refreshSchemas" })
  }, [])

  const startDevServer = useCallback(() => {
    vscode.postMessage({ type: "startDevServer" })
  }, [])

  const stopDevServer = useCallback(() => {
    vscode.postMessage({ type: "stopDevServer" })
  }, [])

  const isDevServer = useCallback((url: string) => url === state.devServerUrl, [state.devServerUrl])

  const addConfig = useCallback(
    (service: string, pipeline: string, schemas: Record<string, PipelineConfig[]>, existingConfigs: LumenConfig[]) => {
      const schema = schemas[service]?.find((p) => p.id === pipeline)
      const displayName = schema?.name ?? pipeline
      const dupeCount = existingConfigs.filter((c) => c.service === service && c.pipeline === pipeline).length
      const name = dupeCount === 0 ? displayName : `${displayName} #${dupeCount + 1}`
      const config: LumenConfig = { id: crypto.randomUUID(), name, service, pipeline, params: {} }
      dispatch({ type: "addConfig", config })
      vscode.postMessage({ type: "addConfig", config })
    },
    [],
  )

  const updateName = useCallback((configId: string, name: string) => {
    dispatch({ type: "updateName", configId, name })
    vscode.postMessage({ type: "updateName", configId, name })
  }, [])

  const pickImage = useCallback((configId: string, service: string, pipeline: string, paramName: string) => {
    dispatch({ type: "pickImageStart" })
    vscode.postMessage({ type: "pickImage", requestId: crypto.randomUUID(), configId, service, pipeline, paramName })
  }, [])

  const pickImageByUri = useCallback(
    (configId: string, service: string, pipeline: string, paramName: string, uri: string) => {
      dispatch({ type: "pickImageStart" })
      vscode.postMessage({
        type: "pickImageByUri",
        requestId: crypto.randomUUID(),
        configId,
        service,
        pipeline,
        paramName,
        uri,
      })
    },
    [],
  )

  return {
    ...state,
    isDevServer,
    addConfig,
    updateParam,
    updateName,
    setFocus,
    requestGenerate,
    refreshSchemas,
    startDevServer,
    stopDevServer,
    pickImage,
    pickImageByUri,
  }
}
