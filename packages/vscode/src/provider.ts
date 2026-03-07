import { existsSync, readFileSync, readdirSync, writeFileSync } from "node:fs"
import { basename, dirname, join, relative, resolve } from "node:path"
import * as vscode from "vscode"
import type { LumenConfig, PipelineConfig, ServerStatus } from "../shared/types"
import type { ExtensionMessage, WebviewMessage } from "../webview/lib/messaging"
import { fetchPipelines, generate, pollUntilDone } from "./api"
import { FAL_PROVIDER_URL, falPipelines, generate as falGenerate, getApiKey, uploadImage } from "./providers/fal"
import { type DevServerState, resolveServerPath } from "./server"

const log = vscode.window.createOutputChannel("Lumen")

const HEALTH_POLL_MS = 10_000

export class LumenEditorProvider implements vscode.CustomTextEditorProvider {
  private static readonly viewType = "lumen.stateViewer"
  private readonly panels: Set<vscode.WebviewPanel> = new Set()
  private schemas: Record<string, PipelineConfig[]> = {}
  private serverStatuses: Record<string, ServerStatus> = {}
  private devServerState: DevServerState = "stopped"
  private healthTimer: ReturnType<typeof setInterval> | null = null
  private falApiKey: string | null = null

  /** Set by extension.ts to route webview start/stop commands to ServerManager */
  onDevServerCommand: ((cmd: "start" | "stop") => void) | null = null

  static register(provider: LumenEditorProvider): vscode.Disposable {
    return vscode.window.registerCustomEditorProvider(LumenEditorProvider.viewType, provider, {
      supportsMultipleEditorsPerDocument: false,
    })
  }

  constructor(private readonly context: vscode.ExtensionContext) {}

  private getDevServerUrl(): string | null {
    const path = resolveServerPath()
    const url = vscode.workspace.getConfiguration("lumen").get<string>("devServerUrl", "")
    return path && url ? url : null
  }

  private getAllServerUrls(): string[] {
    const devUrl = this.getDevServerUrl()
    const deployed = vscode.workspace.getConfiguration("lumen").get<string[]>("serverUrls", [])
    const urls = devUrl ? [devUrl, ...deployed] : [...deployed]
    if (this.falApiKey) urls.push(FAL_PROVIDER_URL)
    return urls
  }

  async refreshFalApiKey(): Promise<void> {
    const prev = this.falApiKey
    this.falApiKey = (await getApiKey(this.context.secrets)) ?? null
    if (this.falApiKey && !prev) {
      this.refreshSchemas(FAL_PROVIDER_URL)
    } else if (!this.falApiKey && prev) {
      delete this.schemas[FAL_PROVIDER_URL]
      delete this.serverStatuses[FAL_PROVIDER_URL]
      this.broadcastToAll({ type: "schemaRefresh", serverUrl: FAL_PROVIDER_URL, pipelines: [] })
    }
  }

  onDevServerStateChange(state: DevServerState): void {
    this.devServerState = state
    this.broadcastToAll({ type: "devServerStatus", state })
    if (state === "running") {
      for (const url of this.getAllServerUrls()) this.refreshSchemas(url)
    }
  }

  async resolveCustomTextEditor(document: vscode.TextDocument, webviewPanel: vscode.WebviewPanel): Promise<void> {
    this.panels.add(webviewPanel)
    const resourceRoots = [
      vscode.Uri.file(join(this.context.extensionPath, "dist", "webview")),
      vscode.Uri.file(dirname(document.uri.fsPath)),
      ...(vscode.workspace.workspaceFolders ?? []).map((f) => f.uri),
    ]
    webviewPanel.webview.options = { enableScripts: true, localResourceRoots: resourceRoots }
    webviewPanel.webview.html = this.getHtml(webviewPanel.webview)

    let updatingFromWebview = false

    const postConfigs = () => {
      if (updatingFromWebview) return
      const configs = this.parseDocument(document)
      this.postMessage(webviewPanel, { type: "configsUpdated", configs })
    }

    // Fetch schemas for all configured servers on first open
    for (const url of this.getAllServerUrls()) {
      if (!this.schemas[url]) {
        this.refreshSchemas(url)
      }
    }

    // Start health polling if first panel
    if (this.panels.size === 1) this.startHealthPolling()

    webviewPanel.webview.onDidReceiveMessage(async (msg: WebviewMessage) => {
      switch (msg.type) {
        case "ready": {
          log.appendLine("[ready] webview ready")
          const configs = this.parseDocument(document)
          if (this.ensureIds(configs)) {
            updatingFromWebview = true
            await this.writeDocument(document, configs)
            updatingFromWebview = false
          }
          // Ensure every configured URL appears in schemas (even if not yet fetched)
          for (const url of this.getAllServerUrls()) {
            if (!this.schemas[url]) this.schemas[url] = []
          }
          this.postMessage(webviewPanel, {
            type: "init",
            schemas: this.schemas,
            configs,
            serverStatuses: this.serverStatuses,
            devServerState: this.devServerState,
            devServerUrl: this.getDevServerUrl(),
          })
          // Send thumbnails for any image paths already in configs
          const docDir = dirname(document.uri.fsPath)
          const thumbs: Record<string, string> = {}
          for (const config of configs) {
            for (const val of Object.values(config.params)) {
              if (typeof val === "string" && val && !val.startsWith("http")) {
                const uri = this.imageThumbUri(val, docDir, webviewPanel.webview)
                if (uri) thumbs[val] = uri
              }
            }
          }
          if (Object.keys(thumbs).length > 0) {
            this.postMessage(webviewPanel, { type: "imageThumbs", thumbs })
          }
          break
        }

        case "updateState": {
          const configs = this.parseDocument(document)
          const idx = configs.findIndex((c) => c.id === msg.configId)
          if (idx >= 0) {
            configs[idx] = { ...configs[idx], params: { ...configs[idx].params, [msg.paramName]: msg.value } }
            updatingFromWebview = true
            await this.writeDocument(document, configs)
            updatingFromWebview = false
          }
          break
        }

        case "generateRequest": {
          const { requestId, configId, service, pipeline, params } = msg

          const handleComplete = async (response: import("../shared/types").GenerateResponse) => {
            if (response.status === "completed") {
              for (const output of response.outputs) {
                output.url = await this.saveAsset(output.url, document.uri, output.format ?? "png", webviewPanel)
              }
              // Auto-fill seed from server response so preview seed is locked for finalize
              const meta = response.outputs[0]?.metadata
              if (meta?.seed != null) {
                const configs = this.parseDocument(document)
                const idx = configs.findIndex((c) => c.id === configId)
                if (idx >= 0) {
                  configs[idx] = { ...configs[idx], params: { ...configs[idx].params, seed: meta.seed } }
                  updatingFromWebview = true
                  await this.writeDocument(document, configs)
                  updatingFromWebview = false
                  postConfigs()
                }
              }
            }
            this.postMessage(webviewPanel, {
              type: "generateResult",
              requestId,
              configId,
              service,
              pipeline,
              response,
            })
          }

          try {
            const response = await this.doGenerate(service, pipeline, params, document.uri)

            if (response.status === "running" || response.status === "queued") {
              pollUntilDone(service, pipeline, response.runId, (progress) => {
                this.postMessage(webviewPanel, {
                  type: "generateProgress",
                  requestId,
                  configId,
                  service,
                  pipeline,
                  progress,
                })
              })
                .then(handleComplete)
                .catch((err) => {
                  this.postMessage(webviewPanel, {
                    type: "generateResult",
                    requestId,
                    configId,
                    service,
                    pipeline,
                    error: err instanceof Error ? err.message : String(err),
                  })
                })
            } else {
              await handleComplete(response)
            }
          } catch (err) {
            this.postMessage(webviewPanel, {
              type: "generateResult",
              requestId,
              configId,
              service,
              pipeline,
              error: err instanceof Error ? err.message : String(err),
            })
          }
          break
        }

        case "refreshSchemas": {
          for (const url of this.getAllServerUrls()) {
            this.refreshSchemas(url)
          }
          break
        }

        case "selectConfig": {
          this.context.workspaceState.update(`focusIndex:${document.uri.toString()}`, msg.index)
          break
        }

        case "pickImage": {
          const { requestId, configId, service, pipeline, paramName } = msg
          try {
            const docDir = dirname(document.uri.fsPath)
            const pickedPath = await this.pickImageWithFileBrowser(docDir)
            const thumbUri = pickedPath ? this.imageThumbUri(pickedPath, docDir, webviewPanel.webview) : undefined
            this.postMessage(webviewPanel, {
              type: "imagePicked",
              requestId,
              configId,
              service,
              pipeline,
              paramName,
              url: pickedPath,
              thumbnailUri: thumbUri,
            })
          } catch (err) {
            this.postMessage(webviewPanel, {
              type: "imagePicked",
              requestId,
              configId,
              service,
              pipeline,
              paramName,
              error: err instanceof Error ? err.message : String(err),
            })
          }
          break
        }

        case "pickImageByUri": {
          const { requestId, configId, service, pipeline, paramName, uri } = msg
          try {
            const docDir = dirname(document.uri.fsPath)
            const fsPath = vscode.Uri.parse(uri).fsPath
            const rel = relative(docDir, fsPath)
            const relPath = rel.startsWith(".") ? rel : `./${rel}`
            const thumbUri = this.imageThumbUri(relPath, docDir, webviewPanel.webview)
            this.postMessage(webviewPanel, {
              type: "imagePicked",
              requestId,
              configId,
              service,
              pipeline,
              paramName,
              url: relPath,
              thumbnailUri: thumbUri,
            })
          } catch (err) {
            this.postMessage(webviewPanel, {
              type: "imagePicked",
              requestId,
              configId,
              service,
              pipeline,
              paramName,
              error: err instanceof Error ? err.message : String(err),
            })
          }
          break
        }

        case "addConfig": {
          const configs = this.parseDocument(document)
          configs.push(msg.config)
          updatingFromWebview = true
          await this.writeDocument(document, configs)
          updatingFromWebview = false
          break
        }

        case "updateName": {
          const configs = this.parseDocument(document)
          const idx = configs.findIndex((c) => c.id === msg.configId)
          if (idx >= 0) {
            configs[idx] = { ...configs[idx], name: msg.name }
            updatingFromWebview = true
            await this.writeDocument(document, configs)
            updatingFromWebview = false
          }
          break
        }

        case "startDevServer":
          this.onDevServerCommand?.("start")
          break

        case "stopDevServer":
          this.onDevServerCommand?.("stop")
          break
      }
    })

    const changeListener = vscode.workspace.onDidChangeTextDocument((event) => {
      if (event.document.uri.toString() === document.uri.toString()) {
        postConfigs()
      }
    })

    const configListener = vscode.workspace.onDidChangeConfiguration((event) => {
      if (
        event.affectsConfiguration("lumen.serverUrls") ||
        event.affectsConfiguration("lumen.devServerUrl") ||
        event.affectsConfiguration("lumen.serverPath")
      ) {
        for (const url of this.getAllServerUrls()) {
          if (!this.schemas[url]) {
            this.refreshSchemas(url)
          }
        }
      }
    })

    // Reload webview when dist/webview rebuilds (dev mode)
    const distPath = join(this.context.extensionPath, "dist", "webview")
    const distWatcher = vscode.workspace.createFileSystemWatcher(join(distPath, "**/*"))
    const distListener = distWatcher.onDidChange(() => {
      webviewPanel.webview.html = this.getHtml(webviewPanel.webview)
    })

    webviewPanel.onDidDispose(() => {
      this.panels.delete(webviewPanel)
      changeListener.dispose()
      configListener.dispose()
      distListener.dispose()
      distWatcher.dispose()
      if (this.panels.size === 0) this.stopHealthPolling()
    })
  }

  private startHealthPolling(): void {
    if (this.healthTimer) return
    this.pollHealth()
    this.healthTimer = setInterval(() => this.pollHealth(), HEALTH_POLL_MS)
  }

  private stopHealthPolling(): void {
    if (this.healthTimer) {
      clearInterval(this.healthTimer)
      this.healthTimer = null
    }
  }

  private async pollHealth(): Promise<void> {
    for (const url of this.getAllServerUrls()) {
      if (url.startsWith("provider://")) continue
      const prev = this.serverStatuses[url]
      try {
        const res = await fetch(`${url}/pipelines`, { signal: AbortSignal.timeout(5000) })
        if (res.ok) {
          this.serverStatuses[url] = "connected"
          if (prev !== "connected") this.refreshSchemas(url)
        } else {
          this.serverStatuses[url] = "error"
        }
      } catch {
        this.serverStatuses[url] = "disconnected"
      }
      if (this.serverStatuses[url] !== prev) {
        this.broadcastToAll({ type: "serverStatus", serverUrl: url, status: this.serverStatuses[url] })
      }
    }
  }

  private async refreshSchemas(serverUrl: string): Promise<void> {
    if (serverUrl === FAL_PROVIDER_URL) {
      this.schemas[serverUrl] = falPipelines
      this.serverStatuses[serverUrl] = "connected"
      this.broadcastToAll({ type: "schemaRefresh", serverUrl, pipelines: falPipelines })
      this.broadcastToAll({ type: "serverStatus", serverUrl, status: "connected" })
      return
    }
    try {
      const pipelines = await fetchPipelines(serverUrl)
      this.schemas[serverUrl] = pipelines
      this.serverStatuses[serverUrl] = "connected"
      this.broadcastToAll({ type: "schemaRefresh", serverUrl, pipelines })
      this.broadcastToAll({ type: "serverStatus", serverUrl, status: "connected" })
    } catch (err) {
      log.appendLine(`[schema] Failed to fetch from ${serverUrl}: ${err}`)
      this.serverStatuses[serverUrl] = "error"
      this.schemas[serverUrl] = []
      this.broadcastToAll({ type: "serverStatus", serverUrl, status: "error" })
    }
  }

  private async doGenerate(
    serverUrl: string,
    pipelineId: string,
    params: Record<string, unknown>,
    documentUri: vscode.Uri,
  ): Promise<import("../shared/types").GenerateResponse> {
    if (serverUrl === FAL_PROVIDER_URL) {
      if (!this.falApiKey) throw new Error("fal.ai API key not set. Run 'Lumen: Set fal.ai API Key'.")
      const resolved = { ...params }
      const imageVal = resolved.image_urls as string | undefined
      if (imageVal && !imageVal.startsWith("http")) {
        const absPath = resolve(dirname(documentUri.fsPath), imageVal)
        if (!existsSync(absPath)) throw new Error(`Reference image not found: ${imageVal}`)
        resolved.image_urls = await uploadImage(this.falApiKey, absPath, this.context.globalState)
      }
      return falGenerate(this.falApiKey, pipelineId, resolved)
    }
    return generate(serverUrl, pipelineId, params)
  }

  // --- ID assignment ---

  private ensureIds(configs: LumenConfig[]): boolean {
    let assigned = false
    for (const config of configs) {
      if (!config.id) {
        config.id = crypto.randomUUID()
        assigned = true
      }
    }
    return assigned
  }

  // --- Document parsing & writing ---

  private parseDocument(document: vscode.TextDocument): LumenConfig[] {
    const text = document.getText().trim()
    if (!text || text === "[]" || text === "{}") return []
    try {
      const parsed = JSON.parse(text) as unknown
      if (Array.isArray(parsed)) return parsed as LumenConfig[]
      // Migrate old format: { serverUrl: { pipelineId: { params } }, _pipeline: "..." }
      if (typeof parsed === "object" && parsed !== null) {
        return this.migrateOldFormat(parsed as Record<string, unknown>)
      }
      return []
    } catch {
      return []
    }
  }

  private migrateOldFormat(raw: Record<string, unknown>): LumenConfig[] {
    const configs: LumenConfig[] = []
    for (const [key, value] of Object.entries(raw)) {
      if (key.startsWith("_") || typeof value !== "object" || value === null) continue
      const pipelines = value as Record<string, unknown>
      for (const [pipelineId, params] of Object.entries(pipelines)) {
        if (typeof params !== "object" || params === null) continue
        configs.push({
          id: crypto.randomUUID(),
          service: key,
          pipeline: pipelineId,
          params: params as Record<string, unknown>,
        })
      }
    }
    return configs
  }

  private async writeDocument(document: vscode.TextDocument, configs: LumenConfig[]): Promise<void> {
    const text = JSON.stringify(configs, null, 2) + "\n"
    const edit = new vscode.WorkspaceEdit()
    edit.replace(document.uri, new vscode.Range(0, 0, document.lineCount, 0), text)
    await vscode.workspace.applyEdit(edit)
  }

  // --- Utilities ---

  private pickImageWithFileBrowser(docDir: string): Promise<string | undefined> {
    type PickItem = vscode.QuickPickItem & { dirName?: string; imagePath?: string }
    const IMAGE_EXT = /\.(png|jpg|jpeg|webp|gif)$/i

    return new Promise((resolve) => {
      let currentDir = docDir
      let settled = false
      const done = (path: string | undefined) => {
        if (settled) return
        settled = true
        resolve(path)
      }

      const buildItems = (): PickItem[] => {
        const items: PickItem[] = [{ label: "$(arrow-up) ../", alwaysShow: true, dirName: ".." }]
        try {
          const entries = readdirSync(currentDir, { withFileTypes: true })
            .filter((e) => !e.name.startsWith("."))
            .sort((a, b) => {
              if (a.isDirectory() !== b.isDirectory()) return a.isDirectory() ? -1 : 1
              return a.name.localeCompare(b.name)
            })
          for (const entry of entries) {
            if (entry.isDirectory()) {
              items.push({ label: `$(folder) ${entry.name}`, alwaysShow: true, dirName: entry.name })
            } else if (IMAGE_EXT.test(entry.name)) {
              const abs = join(currentDir, entry.name)
              const rel = relative(docDir, abs)
              const norm = rel.startsWith(".") ? rel : `./${rel}`
              items.push({ label: entry.name, description: norm, alwaysShow: true, imagePath: norm })
            }
          }
        } catch {
          // permission error
        }
        return items
      }

      const qp = vscode.window.createQuickPick<PickItem>()
      qp.title = "Pick reference image"

      const navigateTo = (dir: string) => {
        currentDir = dir
        const rel = relative(docDir, dir)
        qp.placeholder = (rel || ".") + "/"
        qp.value = ""
        qp.items = buildItems()
      }

      qp.onDidAccept(() => {
        const item = qp.activeItems[0]
        if (!item) return
        if (item.dirName) {
          navigateTo(join(currentDir, item.dirName))
        } else if (item.imagePath) {
          done(item.imagePath)
          qp.hide()
        }
      })

      qp.onDidHide(() => {
        done(undefined)
        qp.dispose()
      })

      navigateTo(docDir)
      qp.show()
    })
  }

  private imageThumbUri(relPath: string, docDir: string, webview: vscode.Webview): string | undefined {
    if (!relPath || relPath.startsWith("http")) return undefined
    const absPath = resolve(docDir, relPath)
    if (!existsSync(absPath)) return undefined
    return webview.asWebviewUri(vscode.Uri.file(absPath)).toString()
  }

  private postMessage(panel: vscode.WebviewPanel, message: ExtensionMessage): void {
    panel.webview.postMessage(message)
  }

  private broadcastToAll(message: ExtensionMessage): void {
    for (const panel of this.panels) {
      this.postMessage(panel, message)
    }
  }

  private async saveAsset(
    url: string,
    documentUri: vscode.Uri,
    format: string,
    panel: vscode.WebviewPanel,
  ): Promise<string> {
    const dir = dirname(documentUri.fsPath)
    const base = basename(documentUri.fsPath, ".lumen")
    const now = new Date()
    const pad = (n: number) => String(n).padStart(2, "0")
    const timestamp = `${String(now.getFullYear()).slice(2)}${pad(now.getMonth() + 1)}${pad(now.getDate())}${pad(now.getHours())}${pad(now.getMinutes())}${pad(now.getSeconds())}`
    const filePath = join(dir, `${base}-${timestamp}.${format}`)

    let buffer: Buffer
    if (url.startsWith("data:")) {
      const base64 = url.split(",")[1]
      buffer = Buffer.from(base64, "base64")
    } else {
      const res = await fetch(url)
      if (!res.ok) throw new Error(`Failed to download asset: ${res.status}`)
      buffer = Buffer.from(await res.arrayBuffer())
    }

    writeFileSync(filePath, buffer)
    log.appendLine(`[asset] Saved ${filePath}`)

    const webviewUri = panel.webview.asWebviewUri(vscode.Uri.file(filePath))
    return webviewUri.toString()
  }

  private getHtml(webview: vscode.Webview): string {
    const distPath = join(this.context.extensionPath, "dist", "webview")

    let html: string
    try {
      html = readFileSync(join(distPath, "index.html"), "utf-8")
    } catch {
      return "<html><body><p>Webview not built. Run <code>bun run build</code>.</p></body></html>"
    }

    const baseUri = webview.asWebviewUri(vscode.Uri.file(distPath))
    html = html.replace(/(href|src)="\.?\/?/g, `$1="${baseUri.toString()}/`)
    html = html.replace(/ crossorigin/g, "")
    html = html.replace(' type="module"', " defer")

    log.appendLine(`[html] ${html.substring(0, 600)}`)
    return html
  }
}
