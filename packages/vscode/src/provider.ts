import {
  appendFileSync,
  existsSync,
  readFileSync,
  readdirSync,
  writeFileSync,
} from "node:fs";
import { dirname, join, relative, resolve } from "node:path";
import * as vscode from "vscode";
import type {
  LumenConfig,
  PipelineConfig,
  ServerStatus,
} from "@lumen/core/types";
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
import {
  FAL_PROVIDER_URL,
  falProvider,
  getApiKey,
} from "./adapters/fal-provider";
import { vscodeAssetStore } from "./adapters/vscode-assets";
import { vscodeLogger } from "./adapters/vscode-logger";
import { vscodeSecretStore } from "./adapters/vscode-secrets";
import { type DevServerState, getServers } from "./server";

export class LumenEditorProvider implements vscode.CustomTextEditorProvider {
  private static readonly viewType = "lumen.stateViewer";
  private readonly panels: Set<vscode.WebviewPanel> = new Set();
  private readonly logFiles: Set<string> = new Set();
  private schemas: SchemaCache = {};
  private serverStatuses: StatusCache = {};
  private devServerState: DevServerState = "stopped";
  private subscriptions: Map<string, () => void> = new Map();
  private falApiKey: string | null = null;
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

    // Asset store needs a panel reference for webview URIs — set per-save
    const assets = vscodeAssetStore({
      logger,
      toWebviewUri: (filePath: string) => {
        // Use the first available panel for URI conversion
        const panel = this.panels.values().next().value;
        if (!panel) return filePath;
        return panel.webview.asWebviewUri(vscode.Uri.file(filePath)).toString();
      },
    });

    this.service = editorService({
      providers: this.providers,
      assets,
      secrets: vscodeSecretStore(context.secrets),
      logger,
    });
  }

  private rebuildProviders(): void {
    // Clear and rebuild provider map
    for (const key of Object.keys(this.providers)) {
      delete this.providers[key];
    }
    for (const s of getServers()) {
      this.providers[s.url] = httpProvider(s.url);
    }
    if (this.falApiKey) {
      this.providers[FAL_PROVIDER_URL] = falProvider({
        apiKey: () => this.falApiKey,
        storage: this.context.globalState,
        resolveImagePath: (rel) => {
          // Resolve relative to the first open document
          const panel = this.panels.values().next().value;
          if (!panel) return rel;
          return rel;
        },
      });
    }
  }

  private getDevServer() {
    return getServers().find((s) => s.source) ?? null;
  }

  private getAllServerUrls(): string[] {
    const urls = getServers().map((s) => s.url);
    if (this.falApiKey) urls.push(FAL_PROVIDER_URL);
    return urls;
  }

  private getServerNames(): Record<string, string> {
    const names: Record<string, string> = {};
    for (const s of getServers()) {
      names[s.url] = s.name;
    }
    return names;
  }

  async refreshFalApiKey(): Promise<void> {
    const prev = this.falApiKey;
    this.falApiKey = (await getApiKey(this.context.secrets)) ?? null;
    this.rebuildProviders();
    if (this.falApiKey && !prev) {
      this.refreshSchemas(FAL_PROVIDER_URL);
    } else if (!this.falApiKey && prev) {
      delete this.schemas[FAL_PROVIDER_URL];
      delete this.serverStatuses[FAL_PROVIDER_URL];
      this.broadcastToAll({
        type: "schemaRefresh",
        serverUrl: FAL_PROVIDER_URL,
        pipelines: [],
      });
    }
  }

  onDevServerStateChange(state: DevServerState): void {
    this.devServerState = state;
    this.broadcastToAll({ type: "devServerStatus", state });
    if (state === "running") {
      this.unsubscribeAll();
      this.rebuildProviders();
      this.subscribeAll();
    }
  }

  private static readonly ANSI_RE = /\x1b\[[0-9;]*[a-zA-Z]|\x1b].*?\x07/g;

  broadcastDevServerLog(text: string): void {
    this.broadcastToAll({ type: "devServerLog", text });
    if (this.logFiles.size > 0) {
      const clean = text.replace(LumenEditorProvider.ANSI_RE, "");
      for (const path of this.logFiles) {
        try {
          appendFileSync(path, clean);
        } catch {}
      }
    }
  }

  async resolveCustomTextEditor(
    document: vscode.TextDocument,
    webviewPanel: vscode.WebviewPanel,
  ): Promise<void> {
    this.panels.add(webviewPanel);
    this.rebuildProviders();

    // Companion log file — truncated on each session
    const logPath = document.uri.fsPath + ".log";
    writeFileSync(logPath, "");
    this.logFiles.add(logPath);

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

    // Subscribe to all servers on first panel open
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
          for (const url of this.getAllServerUrls()) {
            if (!this.schemas[url]) this.schemas[url] = [];
          }
          const devServer = this.getDevServer();
          this.postMessage(webviewPanel, {
            type: "init",
            schemas: this.schemas,
            configs,
            serverStatuses: this.serverStatuses,
            serverNames: this.getServerNames(),
            devServerState: this.devServerState,
            devServerUrl: devServer?.url ?? null,
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

          // Update fal provider's image resolver for this document
          if (this.providers[FAL_PROVIDER_URL]) {
            this.providers[FAL_PROVIDER_URL] = falProvider({
              apiKey: () => this.falApiKey,
              storage: this.context.globalState,
              resolveImagePath: (rel) => resolve(docDir, rel),
            });
          }

          try {
            const response = await this.service.generate(
              service,
              pipeline,
              params,
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
          for (const url of this.getAllServerUrls()) {
            this.refreshSchemas(url);
          }
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
        if (event.affectsConfiguration("lumen.servers")) {
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
      this.logFiles.delete(logPath);
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
    for (const url of this.getAllServerUrls()) {
      this.subscribeTo(url);
    }
  }

  private subscribeTo(url: string): void {
    if (this.subscriptions.has(url)) return;
    const provider = this.providers[url];
    if (!provider) return;

    if (provider.subscribe) {
      const dispose = provider.subscribe({
        onSchemas: (schemas) => {
          this.schemas[url] = schemas;
          this.broadcastToAll({
            type: "schemaRefresh",
            serverUrl: url,
            pipelines: schemas,
          });
        },
        onStatus: (status) => {
          this.serverStatuses[url] = status;
          this.broadcastToAll({ type: "serverStatus", serverUrl: url, status });
        },
      });
      this.subscriptions.set(url, dispose);
    } else {
      // Non-SSE providers (e.g. fal) — one-shot schema fetch
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

    this.log.appendLine(`[html] ${html.substring(0, 600)}`);
    return html;
  }
}
