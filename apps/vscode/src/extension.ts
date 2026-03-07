import * as vscode from "vscode"
import { ImagicEditorProvider } from "./provider"
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
  const output = vscode.window.createOutputChannel("Imagic Server")
  const provider = new ImagicEditorProvider(context)

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
    ImagicEditorProvider.register(provider),

    vscode.commands.registerCommand("imagic.openPreview", () => {
      const uri = vscode.window.activeTextEditor?.document.uri
      if (!uri) return
      vscode.commands.executeCommand("vscode.openWith", uri, "imagic.stateViewer")
    }),

    vscode.commands.registerCommand("imagic.openAsJson", () => {
      const uri = activeDocumentUri()
      if (!uri) return
      vscode.commands.executeCommand("vscode.openWith", uri, "default")
    }),

    vscode.commands.registerCommand("imagic.startServer", () => serverManager.start()),
    vscode.commands.registerCommand("imagic.stopServer", () => serverManager.stop()),

    vscode.commands.registerCommand("imagic.setFalApiKey", async () => {
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
