import { appendFileSync, writeFileSync } from "node:fs";
import * as vscode from "vscode";
import type { LoggerPort } from "@vladpazych/lumen/ports";

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

const ANSI_RE = /\x1b\[[0-9;]*[a-zA-Z]|\x1b].*?\x07/g;

export type FileLogger = {
  append(text: string): void;
  clear(): void;
};

export function fileLogger(getPath: () => string | undefined): FileLogger {
  return {
    append(text: string): void {
      const path = getPath();
      if (!path) return;
      try {
        appendFileSync(path, text.replace(ANSI_RE, ""));
      } catch {}
    },
    clear(): void {
      const path = getPath();
      if (!path) return;
      try {
        writeFileSync(path, "");
      } catch {}
    },
  };
}
