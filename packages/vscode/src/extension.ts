import * as vscode from "vscode";
import { LumenEditorProvider } from "./provider";
import { ServerManager, getServerSource, migrateLegacyServerSetting } from "./server";
import { openWorkspaceHome } from "./workspace-home";
import { WorkspaceSecretStore } from "./workspace-secrets";

function activeDocumentUri(): vscode.Uri | undefined {
  const textUri = vscode.window.activeTextEditor?.document.uri;
  if (textUri) return textUri;
  const tab = vscode.window.tabGroups.activeTabGroup.activeTab;
  if (tab?.input instanceof vscode.TabInputCustom) return tab.input.uri;
  return undefined;
}

export function activate(context: vscode.ExtensionContext): void {
  void migrateLegacyServerSetting();
  const output = vscode.window.createOutputChannel("Lumen Engine");
  const workspaceSecrets = new WorkspaceSecretStore(
    context.secrets,
    () => vscode.workspace.workspaceFolders?.[0]?.uri.fsPath ?? null,
  );
  const provider = new LumenEditorProvider(context, workspaceSecrets);

  const serverManager = new ServerManager(
    output,
    workspaceSecrets,
    () => {
      provider.onDevServerStateChange(
        serverManager.getState(getServerSource()),
      );
    },
    (text) => {
      provider.broadcastDevServerLog(text);
    },
    () => {
      provider.clearDevLog();
    },
    (source, url) => {
      provider.onServerUrlDetected(source, url);
    },
  );

  // Check for already-running dev server from a previous session
  const source = getServerSource();
  if (source) {
    provider.onDevServerStateChange(serverManager.getState(source));
  }

  context.subscriptions.push(
    LumenEditorProvider.register(provider),

    vscode.commands.registerCommand("lumen.openPreview", () => {
      const uri = vscode.window.activeTextEditor?.document.uri;
      if (!uri) return;
      vscode.commands.executeCommand(
        "vscode.openWith",
        uri,
        "lumen.stateViewer",
      );
    }),

    vscode.commands.registerCommand("lumen.openAsJson", () => {
      const uri = activeDocumentUri();
      if (!uri) return;
      vscode.commands.executeCommand("vscode.openWith", uri, "default");
    }),

    vscode.commands.registerCommand("lumen.initWorkspace", () =>
      openWorkspaceHome(),
    ),

    vscode.commands.registerCommand("lumen.startServer", () =>
      serverManager.start(getServerSource()),
    ),
    vscode.commands.registerCommand("lumen.stopServer", () =>
      serverManager.stop(getServerSource()),
    ),

    output,
  );

  provider.onDevServerCommand = (cmd: "start" | "stop" | "restart") => {
    const source = getServerSource();
    if (cmd === "start") {
      void serverManager.start(source);
    } else if (cmd === "restart") {
      void serverManager.restart(source);
    } else {
      void serverManager.stop(source);
    }
  };
}

export function deactivate(): void {}
