import { existsSync, readFileSync, unlinkSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { spawn } from "node:child_process";
import * as vscode from "vscode";

import type { ServerConfig } from "@lumen/core/types";

export type DevServerState = "stopped" | "starting" | "running" | "error";

/** Expand ${workspaceFolder} in a path string. */
export function resolveSource(raw: string): string {
  const root = vscode.workspace.workspaceFolders?.[0]?.uri.fsPath ?? "";
  return raw.replace(/\$\{workspaceFolder\}/g, root);
}

/** Read lumen.servers and resolve source paths. */
export function getServers(): ServerConfig[] {
  const raw = vscode.workspace
    .getConfiguration("lumen")
    .get<ServerConfig[]>("servers", []);
  return raw.map((s) => ({
    ...s,
    source: s.source ? resolveSource(s.source) : undefined,
  }));
}

function pidFile(serverPath: string): string {
  return join(serverPath, ".dev.pid");
}

function isAlive(pid: number): boolean {
  try {
    process.kill(pid, 0);
    return true;
  } catch {
    return false;
  }
}

function readPid(serverPath: string): number | null {
  const file = pidFile(serverPath);
  if (!existsSync(file)) return null;
  const pid = parseInt(readFileSync(file, "utf-8").trim(), 10);
  if (isNaN(pid) || !isAlive(pid)) {
    try {
      unlinkSync(file);
    } catch {}
    return null;
  }
  return pid;
}

export class ServerManager {
  private readonly output: vscode.OutputChannel;
  private readonly onChange: () => void;

  constructor(output: vscode.OutputChannel, onChange: () => void) {
    this.output = output;
    this.onChange = onChange;
  }

  getState(sourcePath: string): DevServerState {
    if (!sourcePath) return "stopped";
    return readPid(sourcePath) !== null ? "running" : "stopped";
  }

  start(sourcePath: string): void {
    if (!sourcePath) {
      vscode.window.showErrorMessage(
        "No server with source configured in lumen.servers",
      );
      return;
    }
    if (readPid(sourcePath) !== null) {
      vscode.window.showWarningMessage("Dev server is already running");
      return;
    }

    this.output.appendLine(`[dev] Starting bun dev in ${sourcePath}`);
    this.output.show(true);

    const shell = process.env.SHELL || "/bin/zsh";
    const child = spawn(shell, ["-l", "-c", "exec bun dev"], {
      cwd: sourcePath,
      stdio: ["ignore", "pipe", "pipe"],
      detached: true,
    });

    if (child.pid) {
      writeFileSync(pidFile(sourcePath), String(child.pid));
    }

    child.stdout?.on("data", (d: Buffer) => this.output.append(d.toString()));
    child.stderr?.on("data", (d: Buffer) => this.output.append(d.toString()));

    child.on("close", (code) => {
      this.output.appendLine(`[dev] Exited with code ${code}`);
      try {
        unlinkSync(pidFile(sourcePath));
      } catch {}
      this.onChange();
    });

    child.on("error", (err) => {
      this.output.appendLine(`[dev] Error: ${err.message}`);
      try {
        unlinkSync(pidFile(sourcePath));
      } catch {}
      this.onChange();
    });

    child.unref();
    this.onChange();
  }

  stop(sourcePath: string): void {
    if (!sourcePath) return;
    const pid = readPid(sourcePath);
    if (pid === null) {
      vscode.window.showWarningMessage("Dev server is not running");
      return;
    }
    this.output.appendLine(`[dev] Killing PID ${pid}`);
    try {
      process.kill(-pid, "SIGTERM");
    } catch {
      process.kill(pid, "SIGTERM");
    }
    try {
      unlinkSync(pidFile(sourcePath));
    } catch {}
    this.onChange();
  }
}
