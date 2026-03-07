import * as vscode from "vscode";
import { LumenEditorProvider } from "./provider";
import { ServerManager, getServerSource } from "./server";

function activeDocumentUri(): vscode.Uri | undefined {
  const textUri = vscode.window.activeTextEditor?.document.uri;
  if (textUri) return textUri;
  const tab = vscode.window.tabGroups.activeTabGroup.activeTab;
  if (tab?.input instanceof vscode.TabInputCustom) return tab.input.uri;
  return undefined;
}

export function activate(context: vscode.ExtensionContext): void {
  const output = vscode.window.createOutputChannel("Lumen Server");
  const provider = new LumenEditorProvider(context);

  const serverManager = new ServerManager(
    output,
    () => {
      provider.onDevServerStateChange(
        serverManager.getState(getServerSource()),
      );
    },
    (text) => {
      provider.broadcastDevServerLog(text);
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
      serverManager.start(source);
    } else if (cmd === "restart") {
      serverManager.restart(source);
    } else {
      serverManager.stop(source);
    }
  };
}

export function deactivate(): void {}
