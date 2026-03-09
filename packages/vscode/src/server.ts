import { existsSync, readFileSync, unlinkSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { spawn } from "node:child_process";
import * as vscode from "vscode";
import type { DevServerState } from "../webview/lib/messaging";
import {
  clearLastUrl,
  ensureAuthKey,
  writeLastUrl,
} from "./server-state";

/** Read lumen.server setting and resolve ${workspaceFolder}. */
export function getServerSource(): string {
  const raw = vscode.workspace
    .getConfiguration("lumen")
    .get<string>("server", "server");
  const root = vscode.workspace.workspaceFolders?.[0]?.uri.fsPath ?? "";
  return raw.replace(/\$\{workspaceFolder\}/g, root);
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
const MODAL_URL_RE = /https:\/\/\S+\.modal\.run/;

export class ServerManager {
  private readonly output: vscode.OutputChannel;
  private readonly onChange: () => void;
  private readonly onLog: (text: string) => void;
  private readonly onLogClear: () => void;
  private readonly onUrl: (sourcePath: string, url: string) => void;
  private trackedState: DevServerState = "stopped";

  constructor(
    output: vscode.OutputChannel,
    onChange: () => void,
    onLog: (text: string) => void,
    onLogClear: () => void,
    onUrl: (sourcePath: string, url: string) => void,
  ) {
    this.output = output;
    this.onChange = onChange;
    this.onLog = onLog;
    this.onLogClear = onLogClear;
    this.onUrl = onUrl;
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
      vscode.window.showErrorMessage("No lumen.server configured");
      return;
    }
    if (readPid(sourcePath) !== null) {
      vscode.window.showWarningMessage("Dev server is already running");
      return;
    }

    ensureAuthKey(sourcePath);
    clearLastUrl(sourcePath);
    this.onLogClear();
    this.output.appendLine(
      `[dev] Syncing deps and starting server in ${sourcePath}`,
    );
    this.output.show(true);
    this.setState("starting");

    const shell = process.env.SHELL || "/bin/zsh";
    const child = spawn(
      shell,
      [
        "-l",
        "-c",
        "uv sync && uv run lumen-sdk sync && exec uv run modal serve serve.py",
      ],
      {
        cwd: sourcePath,
        stdio: ["ignore", "pipe", "pipe"],
        detached: true,
      },
    );

    if (child.pid) {
      writeFileSync(pidFile(sourcePath), String(child.pid));
    }

    const handleOutput = (chunk: Buffer) => {
      const text = chunk.toString();
      this.output.append(text);
      this.onLog(text);
      const urlMatch = text.match(MODAL_URL_RE);
      if (urlMatch) {
        writeLastUrl(sourcePath, urlMatch[0]);
        this.onUrl(sourcePath, urlMatch[0]);
      }
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
      clearLastUrl(sourcePath);
      this.setState("stopped");
    });

    child.on("error", (err) => {
      this.output.appendLine(`[dev] Error: ${err.message}`);
      try {
        unlinkSync(pidFile(sourcePath));
      } catch {}
      clearLastUrl(sourcePath);
      this.setState("error");
    });

    child.unref();
  }

  /** Send signal to process group, falling back to direct PID. */
  private sendSignal(pid: number, sig: NodeJS.Signals): void {
    try {
      process.kill(-pid, sig);
    } catch {
      try {
        process.kill(pid, sig);
      } catch {}
    }
  }

  /**
   * Kill a process: SIGINT first (lets Modal tear down the remote app),
   * escalate to SIGTERM after 4s, SIGKILL after 8s.
   * Returns a promise that resolves once the process is dead.
   */
  private killProcess(pid: number): Promise<void> {
    this.sendSignal(pid, "SIGINT");

    return new Promise((resolve) => {
      let elapsed = 0;
      const interval = setInterval(() => {
        elapsed += 500;
        if (!isAlive(pid)) {
          clearInterval(interval);
          resolve();
          return;
        }
        if (elapsed === 4000) this.sendSignal(pid, "SIGTERM");
        if (elapsed === 8000) this.sendSignal(pid, "SIGKILL");
        if (elapsed >= 10000) {
          clearInterval(interval);
          this.output.appendLine(`[dev] PID ${pid} did not exit after 10s`);
          resolve();
        }
      }, 500);
    });
  }

  async stop(sourcePath: string): Promise<void> {
    if (!sourcePath) return;
    const pid = readPid(sourcePath);
    if (pid === null) {
      vscode.window.showWarningMessage("Dev server is not running");
      return;
    }
    this.output.appendLine(`[dev] Stopping PID ${pid}`);
    try {
      unlinkSync(pidFile(sourcePath));
    } catch {}
    clearLastUrl(sourcePath);
    this.setState("stopping");
    await this.killProcess(pid);
    this.setState("stopped");
    this.output.appendLine("[dev] Process stopped");
  }

  async restart(sourcePath: string): Promise<void> {
    if (!sourcePath) return;
    const pid = readPid(sourcePath);
    if (pid !== null) {
      this.output.appendLine(`[dev] Restarting — stopping PID ${pid}`);
      try {
        unlinkSync(pidFile(sourcePath));
      } catch {}
      this.setState("stopping");
      await this.killProcess(pid);
      this.output.appendLine("[dev] Old process stopped");
    }
    this.setState("stopped");
    this.start(sourcePath);
  }
}
