import * as vscode from "vscode"
import { LumenEditorProvider } from "./provider"
import { promptAndStoreApiKey } from "./providers/fal"
import { ServerManager, resolveServerPath } from "./server"

function activeDocumentUri(): vscode.Uri | undefined {
  const textUri = vscode.window.activeTextEditor?.document.uri
  if (textUri) return textUri
  const tab = vscode.window.tabGroups.activeTabGroup.activeTab
  if (tab?.input instanceof vscode.TabInputCustom) return tab.input.uri
  return undefined
}

export function activate(context: vscode.ExtensionContext): void {
  const output = vscode.window.createOutputChannel("Lumen Server")
  const provider = new LumenEditorProvider(context)

  const serverManager = new ServerManager(output, () => {
    provider.onDevServerStateChange(serverManager.getState())
  })

  // Check for already-running dev server from a previous session
  if (resolveServerPath()) {
    provider.onDevServerStateChange(serverManager.getState())
  }

  // Load fal API key from secrets (if previously set)
  provider.refreshFalApiKey()

  context.subscriptions.push(
    LumenEditorProvider.register(provider),

    vscode.commands.registerCommand("lumen.openPreview", () => {
      const uri = vscode.window.activeTextEditor?.document.uri
      if (!uri) return
      vscode.commands.executeCommand("vscode.openWith", uri, "lumen.stateViewer")
    }),

    vscode.commands.registerCommand("lumen.openAsJson", () => {
      const uri = activeDocumentUri()
      if (!uri) return
      vscode.commands.executeCommand("vscode.openWith", uri, "default")
    }),

    vscode.commands.registerCommand("lumen.startServer", () => serverManager.start()),
    vscode.commands.registerCommand("lumen.stopServer", () => serverManager.stop()),

    vscode.commands.registerCommand("lumen.setFalApiKey", async () => {
      const set = await promptAndStoreApiKey(context.secrets)
      if (set) await provider.refreshFalApiKey()
    }),

    output,
  )

  provider.onDevServerCommand = (cmd) => {
    if (cmd === "start") serverManager.start()
    else serverManager.stop()
  }
}

export function deactivate(): void {}
