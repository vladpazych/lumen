import * as vscode from "vscode";
import type { LoggerPort } from "@lumen/core/ports";

export function vscodeLogger(channel: vscode.OutputChannel): LoggerPort {
  return {
    info(message: string): void {
      channel.appendLine(message);
    },
    error(message: string): void {
      channel.appendLine(`[ERROR] ${message}`);
    },
  };
}
