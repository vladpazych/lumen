import * as vscode from "vscode";
import type { LumenConfig } from "@lumen/core/types";
import { parseConfigs, serializeConfigs } from "@lumen/core/domain/config";

/** Thin bridge for reading/writing .lumen documents with echo prevention. */
export class DocumentBridge {
  private updating = false;

  /** True while an extension-initiated write is in progress. */
  get isUpdating(): boolean {
    return this.updating;
  }

  read(document: vscode.TextDocument): LumenConfig[] {
    return parseConfigs(document.getText());
  }

  async write(
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
    this.updating = true;
    try {
      await vscode.workspace.applyEdit(edit);
    } finally {
      this.updating = false;
    }
  }
}
