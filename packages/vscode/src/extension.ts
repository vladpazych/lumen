import * as vscode from "vscode";
import { LumenEditorProvider } from "./provider";
import { promptAndStoreApiKey } from "./adapters/fal-provider";
import { ServerManager, getServers } from "./server";

function activeDocumentUri(): vscode.Uri | undefined {
  const textUri = vscode.window.activeTextEditor?.document.uri;
  if (textUri) return textUri;
  const tab = vscode.window.tabGroups.activeTabGroup.activeTab;
  if (tab?.input instanceof vscode.TabInputCustom) return tab.input.uri;
  return undefined;
}

function devSourcePath(): string {
  return getServers().find((s) => s.source)?.source ?? "";
}

export function activate(context: vscode.ExtensionContext): void {
  const output = vscode.window.createOutputChannel("Lumen Server");
  const provider = new LumenEditorProvider(context);

  const serverManager = new ServerManager(output, () => {
    provider.onDevServerStateChange(serverManager.getState(devSourcePath()));
  });

  // Check for already-running dev server from a previous session
  const initialSource = devSourcePath();
  if (initialSource) {
    provider.onDevServerStateChange(serverManager.getState(initialSource));
  }

  // Load fal API key from secrets (if previously set)
  provider.refreshFalApiKey();

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
      serverManager.start(devSourcePath()),
    ),
    vscode.commands.registerCommand("lumen.stopServer", () =>
      serverManager.stop(devSourcePath()),
    ),

    vscode.commands.registerCommand("lumen.setFalApiKey", async () => {
      const set = await promptAndStoreApiKey(context.secrets);
      if (set) await provider.refreshFalApiKey();
    }),

    output,
  );

  provider.onDevServerCommand = (cmd: "start" | "stop") => {
    const source = devSourcePath();
    if (cmd === "start") serverManager.start(source);
    else serverManager.stop(source);
  };
}

export function deactivate(): void {}
