import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import * as vscode from "vscode";
import { editorService, type EditorService } from "@lumen/core/editor";
import type {
  DevServerState,
  ExtensionMessage,
  WebviewMessage,
} from "../webview/lib/messaging";
import { vscodeAssetStore } from "./adapters/vscode-assets";
import {
  vscodeLogger,
  fileLogger,
  type FileLogger,
} from "./adapters/vscode-logger";
import { DocumentBridge } from "./document";
import { ServerConnection, type ConnectionEvents } from "./connection";
import { handleMessage, type HandlerContext } from "./handlers";
import { getServerSource } from "./server";

const ANSI_RE = /\x1b\[[0-9;]*[a-zA-Z]|\x1b\].*?\x07|\[[\d;]*[A-Za-z]/g;
function stripAnsi(text: string): string {
  // Replace cursor-up (used by tqdm to overwrite) with \n to preserve line boundaries
  return text.replace(/\x1b\[\d*A/g, "\n").replace(ANSI_RE, "");
}

/** Detect tqdm-style progress bars: `Loading weights:  10%|█ | 41/398` */
const PROGRESS_RE = /^(.*?)\d+%\|/;

export class LumenEditorProvider implements vscode.CustomTextEditorProvider {
  private static readonly viewType = "lumen.stateViewer";
  private readonly panels: Set<vscode.WebviewPanel> = new Set();
  private readonly log: vscode.OutputChannel;
  private readonly fileLog: FileLogger;
  private readonly service: EditorService;
  readonly connection: ServerConnection;
  private readonly devLogBuffer: string[] = [];
  readonly activeJobs = new Map<
    string,
    { progress: number; stage: "queued" | "running" }
  >();

  /** Set by extension.ts to route webview start/stop/restart commands to ServerManager */
  onDevServerCommand: ((cmd: "start" | "stop" | "restart") => void) | null =
    null;

  static register(provider: LumenEditorProvider): vscode.Disposable {
    return vscode.window.registerCustomEditorProvider(
      LumenEditorProvider.viewType,
      provider,
      {
        supportsMultipleEditorsPerDocument: false,
        webviewOptions: { retainContextWhenHidden: true },
      },
    );
  }

  constructor(private readonly context: vscode.ExtensionContext) {
    this.log = vscode.window.createOutputChannel("Lumen");
    const logger = vscodeLogger(this.log);

    this.fileLog = fileLogger(() => {
      const p = vscode.workspace
        .getConfiguration("lumen")
        .get<string>("logFile");
      if (p) return p;
      const source = getServerSource();
      return source ? join(source, "lumen.log") : undefined;
    });

    const assets = vscodeAssetStore({
      logger,
      toWebviewUri: (filePath: string) => {
        const panel = this.panels.values().next().value;
        if (!panel) return filePath;
        return panel.webview.asWebviewUri(vscode.Uri.file(filePath)).toString();
      },
    });

    const connectionEvents: ConnectionEvents = {
      schemasChanged: (serverUrl, pipelines) => {
        this.broadcastToAll({
          type: "schemaRefresh",
          serverUrl,
          pipelines,
        });
      },
      serverStatusChanged: (serverUrl, status) => {
        this.broadcastToAll({ type: "serverStatus", serverUrl, status });
      },
      devServerStateChanged: (state) => {
        this.broadcastToAll({ type: "devServerStatus", state });
      },
    };

    this.connection = new ServerConnection(
      connectionEvents,
      logger,
      this.fileLog,
      getServerSource,
    );

    this.service = editorService({
      providers: this.connection.providers,
      assets,
      secrets: { get: async () => undefined, set: async () => {} },
      logger,
    });

    this.connection.setService(this.service);
  }

  onDevServerStateChange(state: DevServerState): void {
    this.connection.onDevServerStateChange(state);
  }

  onServerUrlDetected(source: string, url: string): void {
    this.connection.onUrlDetected(source, url);
  }

  clearDevLog(): void {
    this.devLogBuffer.length = 0;
    this.fileLog.clear();
  }

  broadcastDevServerLog(text: string): void {
    this.fileLog.append(text);

    // Strip ANSI on full text first — cursor-up codes become \n line boundaries
    const stripped = stripAnsi(text);

    const cleaned: string[] = [];
    for (const raw of stripped.split("\n")) {
      // Handle \r (carriage return): tqdm overwrites the line — keep last segment
      const segments = raw.split("\r").filter((s) => s !== "");
      const line = segments.length > 0 ? segments[segments.length - 1] : "";
      if (!line.trim()) continue;

      // Collapse progress bars: replace last buffer entry if same progress prefix
      const match = line.match(PROGRESS_RE);
      if (match && this.devLogBuffer.length > 0) {
        const prev = this.devLogBuffer[this.devLogBuffer.length - 1];
        const prevMatch = prev.match(PROGRESS_RE);
        if (prevMatch && prevMatch[1].trim() === match[1].trim()) {
          this.devLogBuffer[this.devLogBuffer.length - 1] = line;
          cleaned.push(line);
          continue;
        }
      }

      this.devLogBuffer.push(line);
      cleaned.push(line);
    }

    if (this.devLogBuffer.length > 200) {
      this.devLogBuffer.splice(0, this.devLogBuffer.length - 200);
    }
    if (cleaned.length > 0) {
      this.broadcastToAll({ type: "devServerLog", text: cleaned.join("\n") });
    }
  }

  getDevLogBuffer(): string[] {
    return this.devLogBuffer;
  }

  async resolveCustomTextEditor(
    document: vscode.TextDocument,
    webviewPanel: vscode.WebviewPanel,
  ): Promise<void> {
    this.panels.add(webviewPanel);
    this.connection.rebuildProviders();

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

    const bridge = new DocumentBridge();

    const postConfigs = () => {
      if (bridge.isUpdating) return;
      const configs = bridge.read(document);
      webviewPanel.webview.postMessage({
        type: "configsUpdated",
        configs,
      } satisfies ExtensionMessage);
    };

    if (this.panels.size === 1) this.connection.subscribeAll();

    const handlerCtx: HandlerContext = {
      document,
      panel: webviewPanel,
      bridge,
      connection: this.connection,
      service: this.service,
      context: this.context,
      post: (msg) => webviewPanel.webview.postMessage(msg),
      onDevServerCommand: this.onDevServerCommand,
      getDevLogBuffer: () => this.devLogBuffer,
      activeJobs: this.activeJobs,
    };

    webviewPanel.webview.onDidReceiveMessage((msg: WebviewMessage) => {
      handlerCtx.onDevServerCommand = this.onDevServerCommand;
      handleMessage(handlerCtx, msg);
    });

    const changeListener = vscode.workspace.onDidChangeTextDocument((event) => {
      if (event.document.uri.toString() === document.uri.toString()) {
        postConfigs();
      }
    });

    const configListener = vscode.workspace.onDidChangeConfiguration(
      (event) => {
        if (event.affectsConfiguration("lumen.server")) {
          this.connection.unsubscribeAll();
          this.connection.rebuildProviders();
          this.connection.subscribeAll();
        }
      },
    );

    const docWatcher = vscode.workspace.createFileSystemWatcher(
      document.uri.fsPath,
    );
    const docListener = docWatcher.onDidChange(() => postConfigs());

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
      if (this.panels.size === 0) this.connection.unsubscribeAll();
    });
  }

  private broadcastToAll(message: ExtensionMessage): void {
    for (const panel of this.panels) {
      panel.webview.postMessage(message);
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

    return html;
  }
}
