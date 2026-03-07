import { existsSync, readFileSync, unlinkSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { spawn } from "node:child_process";
import * as vscode from "vscode";

import type { ServerConfig } from "@lumen/core/types";

export type DevServerState =
  | "stopped"
  | "starting"
  | "rebuilding"
  | "running"
  | "error";

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

// Modal stdout patterns for rebuild detection
const REBUILD_START = /Creating objects|Initializing|Building image/;
const REBUILD_DONE = /Created web function serve|Serving app/;

/** Check if a server URL is already reachable. */
export async function isServerReachable(url: string): Promise<boolean> {
  try {
    const res = await fetch(`${url}/pipelines`, {
      signal: AbortSignal.timeout(3000),
    });
    return res.ok;
  } catch {
    return false;
  }
}

export class ServerManager {
  private readonly output: vscode.OutputChannel;
  private readonly onChange: () => void;
  private readonly onLog: (text: string) => void;
  private trackedState: DevServerState = "stopped";

  constructor(
    output: vscode.OutputChannel,
    onChange: () => void,
    onLog: (text: string) => void,
  ) {
    this.output = output;
    this.onChange = onChange;
    this.onLog = onLog;
  }

  getState(sourcePath: string): DevServerState {
    if (!sourcePath) return "stopped";
    // Use tracked state if process is managed by us
    if (this.trackedState !== "stopped") return this.trackedState;
    // Fall back to PID check for externally started servers
    return readPid(sourcePath) !== null ? "running" : "stopped";
  }

  private setState(state: DevServerState): void {
    if (this.trackedState === state) return;
    this.trackedState = state;
    this.onChange();
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
    this.setState("starting");

    const shell = process.env.SHELL || "/bin/zsh";
    const child = spawn(shell, ["-l", "-c", "exec bun dev"], {
      cwd: sourcePath,
      stdio: ["ignore", "pipe", "pipe"],
      detached: true,
    });

    if (child.pid) {
      writeFileSync(pidFile(sourcePath), String(child.pid));
    }

    const handleOutput = (chunk: Buffer) => {
      const text = chunk.toString();
      this.output.append(text);
      this.onLog(text);
      if (REBUILD_DONE.test(text)) {
        this.setState("running");
      } else if (REBUILD_START.test(text)) {
        this.setState("rebuilding");
      }
    };

    child.stdout?.on("data", handleOutput);
    child.stderr?.on("data", handleOutput);

    child.on("close", (code) => {
      this.output.appendLine(`[dev] Exited with code ${code}`);
      try {
        unlinkSync(pidFile(sourcePath));
      } catch {}
      this.setState("stopped");
    });

    child.on("error", (err) => {
      this.output.appendLine(`[dev] Error: ${err.message}`);
      try {
        unlinkSync(pidFile(sourcePath));
      } catch {}
      this.setState("error");
    });

    child.unref();
  }

  /** Send SIGINT (Ctrl+C) so Modal can tear down the remote app, then SIGTERM as fallback. */
  private killProcess(pid: number): void {
    const signal = (sig: NodeJS.Signals) => {
      try {
        process.kill(-pid, sig);
      } catch {
        try {
          process.kill(pid, sig);
        } catch {}
      }
    };
    signal("SIGINT");
    // SIGTERM fallback if still alive after 3s
    setTimeout(() => {
      if (isAlive(pid)) signal("SIGTERM");
    }, 3000);
  }

  stop(sourcePath: string): void {
    if (!sourcePath) return;
    const pid = readPid(sourcePath);
    if (pid === null) {
      vscode.window.showWarningMessage("Dev server is not running");
      return;
    }
    this.output.appendLine(`[dev] Stopping PID ${pid} (SIGINT)`);
    this.killProcess(pid);
    try {
      unlinkSync(pidFile(sourcePath));
    } catch {}
    this.setState("stopped");
  }

  restart(sourcePath: string): void {
    if (!sourcePath) return;
    const pid = readPid(sourcePath);
    if (pid !== null) {
      this.output.appendLine(`[dev] Restarting — stopping PID ${pid}`);
      this.killProcess(pid);
      try {
        unlinkSync(pidFile(sourcePath));
      } catch {}
    }
    this.setState("stopped");
    // Wait for Modal to finish cleanup before restarting
    setTimeout(() => this.start(sourcePath), 2000);
  }
}
