import {
  appendFileSync,
  existsSync,
  readFileSync,
  readdirSync,
  writeFileSync,
} from "node:fs";
import { basename, dirname, join, relative, resolve } from "node:path";
import * as vscode from "vscode";
import type { LumenConfig } from "@lumen/core/types";
import type { ProviderPort } from "@lumen/core/ports";
import {
  parseConfigs,
  serializeConfigs,
  ensureIds,
} from "@lumen/core/domain/config";
import {
  editorService,
  type EditorService,
  type SchemaCache,
  type StatusCache,
} from "@lumen/core/editor";
import type {
  ExtensionMessage,
  WebviewMessage,
} from "../webview/lib/messaging";
import { httpProvider } from "./adapters/http-provider";
import { vscodeAssetStore } from "./adapters/vscode-assets";
import { vscodeLogger } from "./adapters/vscode-logger";
import { type DevServerState, getServerSource } from "./server";

export class LumenEditorProvider implements vscode.CustomTextEditorProvider {
  private static readonly viewType = "lumen.stateViewer";
  private readonly panels: Set<vscode.WebviewPanel> = new Set();
  private schemas: SchemaCache = {};
  private serverStatuses: StatusCache = {};
  private devServerState: DevServerState = "stopped";
  private subscriptions: Map<string, () => void> = new Map();
  private detectedUrl: string | null = null;
  private service: EditorService;
  private providers: Record<string, ProviderPort> = {};
  private readonly log: vscode.OutputChannel;

  /** Set by extension.ts to route webview start/stop/restart commands to ServerManager */
  onDevServerCommand: ((cmd: "start" | "stop" | "restart") => void) | null =
    null;

  static register(provider: LumenEditorProvider): vscode.Disposable {
    return vscode.window.registerCustomEditorProvider(
      LumenEditorProvider.viewType,
      provider,
      { supportsMultipleEditorsPerDocument: false },
    );
  }

  constructor(private readonly context: vscode.ExtensionContext) {
    this.log = vscode.window.createOutputChannel("Lumen");
    const logger = vscodeLogger(this.log);

    const assets = vscodeAssetStore({
      logger,
      toWebviewUri: (filePath: string) => {
        const panel = this.panels.values().next().value;
        if (!panel) return filePath;
        return panel.webview.asWebviewUri(vscode.Uri.file(filePath)).toString();
      },
    });

    this.service = editorService({
      providers: this.providers,
      assets,
      secrets: { get: async () => undefined, set: async () => {} },
      logger,
    });
  }

  private rebuildProviders(): void {
    for (const key of Object.keys(this.providers)) {
      delete this.providers[key];
    }
    if (this.detectedUrl) {
      this.providers[this.detectedUrl] = httpProvider(this.detectedUrl);
    }
  }

  private getServerUrl(): string | null {
    return this.detectedUrl;
  }

  private getServerName(): string {
    return basename(getServerSource());
  }

  onDevServerStateChange(state: DevServerState): void {
    const url = this.getServerUrl();
    if (
      state === "stopped" &&
      url &&
      this.serverStatuses[url] === "connected"
    ) {
      this.devServerState = "orphaned";
      this.broadcastToAll({ type: "devServerStatus", state: "orphaned" });
    } else {
      this.devServerState = state;
      this.broadcastToAll({ type: "devServerStatus", state });
    }
    if (state === "running") {
      this.unsubscribeAll();
      this.rebuildProviders();
      this.subscribeAll();
    }
  }

  onServerUrlDetected(_source: string, url: string): void {
    this.detectedUrl = url;
    this.log.appendLine(`[modal] detected URL: ${url}`);
  }

  broadcastDevServerLog(text: string): void {
    this.broadcastToAll({ type: "devServerLog", text });
    this.appendToLogFile(text);
  }

  async resolveCustomTextEditor(
    document: vscode.TextDocument,
    webviewPanel: vscode.WebviewPanel,
  ): Promise<void> {
    this.panels.add(webviewPanel);
    this.rebuildProviders();

    const resourceRoots = [
      vscode.Uri.file(join(this.context.extensionPath, "dist", "webview")),
      vscode.Uri.file(dirname(document.uri.fsPath)),
      ...(vscode.workspace.workspaceFolders ?? []).map((f) => f.uri),
    ];
    webviewPanel.webview.options = {
      enableScripts: true,
      localResourceRoots: resourceRoots,
    };
    webviewPanel.webview.html = this.getHtml(webviewPanel.webview);

    let updatingFromWebview = false;

    const postConfigs = () => {
      if (updatingFromWebview) return;
      const configs = parseConfigs(document.getText());
      this.postMessage(webviewPanel, { type: "configsUpdated", configs });
    };

    // Subscribe on first panel open
    if (this.panels.size === 1) this.subscribeAll();

    webviewPanel.webview.onDidReceiveMessage(async (msg: WebviewMessage) => {
      switch (msg.type) {
        case "ready": {
          this.log.appendLine("[ready] webview ready");
          const configs = parseConfigs(document.getText());
          if (ensureIds(configs)) {
            updatingFromWebview = true;
            await this.writeDocument(document, configs);
            updatingFromWebview = false;
          }
          const url = this.getServerUrl();
          if (url && !this.schemas[url]) this.schemas[url] = [];
          const serverNames: Record<string, string> = {};
          if (url) serverNames[url] = this.getServerName();
          this.postMessage(webviewPanel, {
            type: "init",
            schemas: this.schemas,
            configs,
            serverStatuses: this.serverStatuses,
            serverNames,
            devServerState: this.devServerState,
            devServerUrl: url,
          });
          // Send thumbnails for image paths
          const docDir = dirname(document.uri.fsPath);
          const thumbs: Record<string, string> = {};
          for (const config of configs) {
            for (const val of Object.values(config.params)) {
              if (typeof val === "string" && val && !val.startsWith("http")) {
                const uri = this.imageThumbUri(
                  val,
                  docDir,
                  webviewPanel.webview,
                );
                if (uri) thumbs[val] = uri;
              }
            }
          }
          if (Object.keys(thumbs).length > 0) {
            this.postMessage(webviewPanel, { type: "imageThumbs", thumbs });
          }
          break;
        }

        case "updateState": {
          const configs = parseConfigs(document.getText());
          const idx = configs.findIndex((c) => c.id === msg.configId);
          if (idx >= 0) {
            configs[idx] = {
              ...configs[idx],
              params: { ...configs[idx].params, [msg.paramName]: msg.value },
            };
            updatingFromWebview = true;
            await this.writeDocument(document, configs);
            updatingFromWebview = false;
          }
          break;
        }

        case "generateRequest": {
          const { requestId, configId, service, pipeline, params } = msg;
          const docDir = dirname(document.uri.fsPath);
          const resolved = this.resolveImageParams(
            service,
            pipeline,
            params,
            docDir,
          );

          try {
            const response = await this.service.generate(
              service,
              pipeline,
              resolved,
              document.uri.fsPath,
              (progress) => {
                this.postMessage(webviewPanel, {
                  type: "generateProgress",
                  requestId,
                  configId,
                  service,
                  pipeline,
                  progress,
                });
              },
            );

            // Auto-fill seed from server response
            if (response.status === "completed") {
              const meta = response.outputs[0]?.metadata;
              if (meta?.seed != null) {
                const configs = parseConfigs(document.getText());
                const idx = configs.findIndex((c) => c.id === configId);
                if (idx >= 0) {
                  configs[idx] = {
                    ...configs[idx],
                    params: { ...configs[idx].params, seed: meta.seed },
                  };
                  updatingFromWebview = true;
                  await this.writeDocument(document, configs);
                  updatingFromWebview = false;
                  postConfigs();
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
            });
          } catch (err) {
            this.postMessage(webviewPanel, {
              type: "generateResult",
              requestId,
              configId,
              service,
              pipeline,
              error: err instanceof Error ? err.message : String(err),
            });
          }
          break;
        }

        case "refreshSchemas": {
          const url = this.getServerUrl();
          if (url) this.refreshSchemas(url);
          break;
        }

        case "selectConfig": {
          this.context.workspaceState.update(
            `focusIndex:${document.uri.toString()}`,
            msg.index,
          );
          break;
        }

        case "pickImage": {
          const { requestId, configId, service, pipeline, paramName } = msg;
          try {
            const docDir = dirname(document.uri.fsPath);
            const pickedPath = await this.pickImageWithFileBrowser(docDir);
            const thumbUri = pickedPath
              ? this.imageThumbUri(pickedPath, docDir, webviewPanel.webview)
              : undefined;
            this.postMessage(webviewPanel, {
              type: "imagePicked",
              requestId,
              configId,
              service,
              pipeline,
              paramName,
              url: pickedPath,
              thumbnailUri: thumbUri,
            });
          } catch (err) {
            this.postMessage(webviewPanel, {
              type: "imagePicked",
              requestId,
              configId,
              service,
              pipeline,
              paramName,
              error: err instanceof Error ? err.message : String(err),
            });
          }
          break;
        }

        case "pickImageByUri": {
          const { requestId, configId, service, pipeline, paramName, uri } =
            msg;
          try {
            const docDir = dirname(document.uri.fsPath);
            const fsPath = vscode.Uri.parse(uri).fsPath;
            const rel = relative(docDir, fsPath);
            const relPath = rel.startsWith(".") ? rel : `./${rel}`;
            const thumbUri = this.imageThumbUri(
              relPath,
              docDir,
              webviewPanel.webview,
            );
            this.postMessage(webviewPanel, {
              type: "imagePicked",
              requestId,
              configId,
              service,
              pipeline,
              paramName,
              url: relPath,
              thumbnailUri: thumbUri,
            });
          } catch (err) {
            this.postMessage(webviewPanel, {
              type: "imagePicked",
              requestId,
              configId,
              service,
              pipeline,
              paramName,
              error: err instanceof Error ? err.message : String(err),
            });
          }
          break;
        }

        case "addConfig": {
          const configs = parseConfigs(document.getText());
          configs.push(msg.config);
          updatingFromWebview = true;
          await this.writeDocument(document, configs);
          updatingFromWebview = false;
          break;
        }

        case "removeConfig": {
          const configs = parseConfigs(document.getText());
          const filtered = configs.filter((c) => c.id !== msg.configId);
          if (filtered.length !== configs.length) {
            updatingFromWebview = true;
            await this.writeDocument(document, filtered);
            updatingFromWebview = false;
          }
          break;
        }

        case "updateName": {
          const configs = parseConfigs(document.getText());
          const idx = configs.findIndex((c) => c.id === msg.configId);
          if (idx >= 0) {
            configs[idx] = { ...configs[idx], name: msg.name };
            updatingFromWebview = true;
            await this.writeDocument(document, configs);
            updatingFromWebview = false;
          }
          break;
        }

        case "startDevServer":
          this.onDevServerCommand?.("start");
          break;

        case "stopDevServer":
          this.onDevServerCommand?.("stop");
          break;

        case "restartDevServer":
          this.onDevServerCommand?.("restart");
          break;
      }
    });

    const changeListener = vscode.workspace.onDidChangeTextDocument((event) => {
      if (event.document.uri.toString() === document.uri.toString()) {
        postConfigs();
      }
    });

    const configListener = vscode.workspace.onDidChangeConfiguration(
      (event) => {
        if (event.affectsConfiguration("lumen.server")) {
          this.unsubscribeAll();
          this.rebuildProviders();
          this.subscribeAll();
        }
      },
    );

    // Re-sync webview when the .lumen file changes on disk (external edits)
    const docWatcher = vscode.workspace.createFileSystemWatcher(
      document.uri.fsPath,
    );
    const docListener = docWatcher.onDidChange(() => postConfigs());

    // Reload webview when dist/webview rebuilds (dev mode)
    const distPath = join(this.context.extensionPath, "dist", "webview");
    const distWatcher = vscode.workspace.createFileSystemWatcher(
      join(distPath, "**/*"),
    );
    const distListener = distWatcher.onDidChange(() => {
      webviewPanel.webview.html = this.getHtml(webviewPanel.webview);
    });

    webviewPanel.onDidDispose(() => {
      this.panels.delete(webviewPanel);
      changeListener.dispose();
      configListener.dispose();
      docListener.dispose();
      docWatcher.dispose();
      distListener.dispose();
      distWatcher.dispose();
      if (this.panels.size === 0) this.unsubscribeAll();
    });
  }

  // --- SSE subscriptions ---

  private subscribeAll(): void {
    const url = this.getServerUrl();
    if (url) this.subscribeTo(url);
  }

  private subscribeTo(url: string): void {
    if (this.subscriptions.has(url)) return;
    const provider = this.providers[url];
    if (!provider) return;

    if (provider.subscribe) {
      this.log.appendLine(`[sse] subscribing to ${url}`);
      const dispose = provider.subscribe({
        onSchemas: (schemas) => {
          const ids = schemas.map((s) => s.id).join(", ");
          this.log.appendLine(`[sse] ${url} schemas: ${ids}`);
          this.appendToLogFile(`[sse] ${url} schemas: ${ids}\n`);
          this.schemas[url] = schemas;
          this.writeSchemaFile(url);
          this.broadcastToAll({
            type: "schemaRefresh",
            serverUrl: url,
            pipelines: schemas,
          });
        },
        onStatus: (status) => {
          this.log.appendLine(`[sse] ${url} ${status}`);
          this.appendToLogFile(`[sse] ${url} ${status}\n`);
          this.serverStatuses[url] = status;
          this.broadcastToAll({ type: "serverStatus", serverUrl: url, status });
          // Detect orphaned dev server: endpoint alive but no local process
          if (status === "connected" && this.devServerState === "stopped") {
            this.devServerState = "orphaned";
            this.broadcastToAll({
              type: "devServerStatus",
              state: "orphaned",
            });
          } else if (
            status === "disconnected" &&
            this.devServerState === "orphaned"
          ) {
            this.devServerState = "stopped";
            this.broadcastToAll({
              type: "devServerStatus",
              state: "stopped",
            });
          }
        },
      });
      this.subscriptions.set(url, dispose);
    } else {
      this.refreshSchemas(url);
    }
  }

  private unsubscribeAll(): void {
    for (const dispose of this.subscriptions.values()) dispose();
    this.subscriptions.clear();
  }

  // --- Schema refresh ---

  private async refreshSchemas(serverUrl: string): Promise<void> {
    const result = await this.service.refreshSchemas(
      serverUrl,
      this.schemas,
      this.serverStatuses,
    );
    this.schemas = result.schemas;
    this.serverStatuses = result.statuses;
    this.writeSchemaFile(serverUrl);
    this.broadcastToAll({
      type: "schemaRefresh",
      serverUrl,
      pipelines: this.schemas[serverUrl] ?? [],
    });
    this.broadcastToAll({
      type: "serverStatus",
      serverUrl,
      status: this.serverStatuses[serverUrl],
    });
  }

  // --- Document I/O ---

  private async writeDocument(
    document: vscode.TextDocument,
    configs: LumenConfig[],
  ): Promise<void> {
    const text = serializeConfigs(configs);
    const edit = new vscode.WorkspaceEdit();
    edit.replace(
      document.uri,
      new vscode.Range(0, 0, document.lineCount, 0),
      text,
    );
    await vscode.workspace.applyEdit(edit);
  }

  // --- Param resolution ---

  /** Convert local image paths to data URIs so servers can receive them. */
  private resolveImageParams(
    service: string,
    pipelineId: string,
    params: Record<string, unknown>,
    docDir: string,
  ): Record<string, unknown> {
    const schema = this.schemas[service]?.find((p) => p.id === pipelineId);
    if (!schema) return params;
    const resolved = { ...params };
    for (const param of schema.params) {
      if (param.type !== "image") continue;
      const val = resolved[param.name];
      if (typeof val !== "string" || !val) continue;
      if (val.startsWith("http") || val.startsWith("data:")) continue;
      const absPath = resolve(docDir, val);
      if (!existsSync(absPath)) continue;
      const bytes = readFileSync(absPath);
      const ext = absPath.split(".").pop()?.toLowerCase() ?? "png";
      const mime = ext === "jpg" ? "image/jpeg" : `image/${ext}`;
      resolved[param.name] = `data:${mime};base64,${bytes.toString("base64")}`;
    }
    return resolved;
  }

  // --- VS Code UI utilities ---

  private pickImageWithFileBrowser(
    docDir: string,
  ): Promise<string | undefined> {
    type PickItem = vscode.QuickPickItem & {
      dirName?: string;
      imagePath?: string;
    };
    const IMAGE_EXT = /\.(png|jpg|jpeg|webp|gif)$/i;

    return new Promise((resolve) => {
      let currentDir = docDir;
      let settled = false;
      const done = (path: string | undefined) => {
        if (settled) return;
        settled = true;
        resolve(path);
      };

      const buildItems = (): PickItem[] => {
        const items: PickItem[] = [
          { label: "$(arrow-up) ../", alwaysShow: true, dirName: ".." },
        ];
        try {
          const entries = readdirSync(currentDir, { withFileTypes: true })
            .filter((e) => !e.name.startsWith("."))
            .sort((a, b) => {
              if (a.isDirectory() !== b.isDirectory())
                return a.isDirectory() ? -1 : 1;
              return a.name.localeCompare(b.name);
            });
          for (const entry of entries) {
            if (entry.isDirectory()) {
              items.push({
                label: `$(folder) ${entry.name}`,
                alwaysShow: true,
                dirName: entry.name,
              });
            } else if (IMAGE_EXT.test(entry.name)) {
              const abs = join(currentDir, entry.name);
              const rel = relative(docDir, abs);
              const norm = rel.startsWith(".") ? rel : `./${rel}`;
              items.push({
                label: entry.name,
                description: norm,
                alwaysShow: true,
                imagePath: norm,
              });
            }
          }
        } catch {
          // permission error
        }
        return items;
      };

      const qp = vscode.window.createQuickPick<PickItem>();
      qp.title = "Pick reference image";

      const navigateTo = (dir: string) => {
        currentDir = dir;
        const rel = relative(docDir, dir);
        qp.placeholder = (rel || ".") + "/";
        qp.value = "";
        qp.items = buildItems();
      };

      qp.onDidAccept(() => {
        const item = qp.activeItems[0];
        if (!item) return;
        if (item.dirName) {
          navigateTo(join(currentDir, item.dirName));
        } else if (item.imagePath) {
          done(item.imagePath);
          qp.hide();
        }
      });

      qp.onDidHide(() => {
        done(undefined);
        qp.dispose();
      });

      navigateTo(docDir);
      qp.show();
    });
  }

  private imageThumbUri(
    relPath: string,
    docDir: string,
    webview: vscode.Webview,
  ): string | undefined {
    if (!relPath || relPath.startsWith("http")) return undefined;
    const absPath = resolve(docDir, relPath);
    if (!existsSync(absPath)) return undefined;
    return webview.asWebviewUri(vscode.Uri.file(absPath)).toString();
  }

  private postMessage(
    panel: vscode.WebviewPanel,
    message: ExtensionMessage,
  ): void {
    panel.webview.postMessage(message);
  }

  private broadcastToAll(message: ExtensionMessage): void {
    for (const panel of this.panels) {
      this.postMessage(panel, message);
    }
  }

  // --- Logging ---

  private static readonly ANSI_RE = /\x1b\[[0-9;]*[a-zA-Z]|\x1b].*?\x07/g;

  private getLogFilePath(): string | undefined {
    const p = vscode.workspace.getConfiguration("lumen").get<string>("logFile");
    return p || undefined;
  }

  private appendToLogFile(text: string): void {
    const logFile = this.getLogFilePath();
    if (!logFile) return;
    try {
      const clean = text.replace(LumenEditorProvider.ANSI_RE, "");
      appendFileSync(logFile, clean);
    } catch {}
  }

  // --- Schema file export ---

  private writeSchemaFile(_serverUrl: string): void {
    const source = getServerSource();
    if (!source) return;
    const dest = join(source, "lumen.schema.json");
    try {
      const schemas = this.schemas[_serverUrl] ?? [];
      writeFileSync(dest, JSON.stringify(schemas, null, 2) + "\n");
    } catch {}
  }

  private getHtml(webview: vscode.Webview): string {
    const distPath = join(this.context.extensionPath, "dist", "webview");

    let html: string;
    try {
      html = readFileSync(join(distPath, "index.html"), "utf-8");
    } catch {
      return "<html><body><p>Webview not built. Run <code>bun run build</code>.</p></body></html>";
    }

    const baseUri = webview.asWebviewUri(vscode.Uri.file(distPath));
    html = html.replace(/(href|src)="\.?\/?/g, `$1="${baseUri.toString()}/`);
    html = html.replace(/ crossorigin/g, "");
    html = html.replace(' type="module"', " defer");

    return html;
  }
}
