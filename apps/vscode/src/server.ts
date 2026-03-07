import { existsSync, readFileSync, unlinkSync, writeFileSync } from "node:fs"
import { join } from "node:path"
import { spawn } from "node:child_process"
import * as vscode from "vscode"

import type { DevServerState } from "../shared/types"
export type { DevServerState }

/** Resolves imagic.serverPath with ${workspaceFolder} expansion. Returns "" if unset. */
export function resolveServerPath(): string {
  const raw = vscode.workspace.getConfiguration("imagic").get<string>("serverPath", "")
  if (!raw) return ""
  const root = vscode.workspace.workspaceFolders?.[0]?.uri.fsPath ?? ""
  return raw.replace(/\$\{workspaceFolder\}/g, root)
}

function pidFile(serverPath: string): string {
  return join(serverPath, ".dev.pid")
}

/** Check if a PID is alive. */
function isAlive(pid: number): boolean {
  try {
    process.kill(pid, 0)
    return true
  } catch {
    return false
  }
}

/** Read stored PID. Returns the PID if alive, null otherwise (cleans up stale file). */
function readPid(serverPath: string): number | null {
  const file = pidFile(serverPath)
  if (!existsSync(file)) return null
  const pid = parseInt(readFileSync(file, "utf-8").trim(), 10)
  if (isNaN(pid) || !isAlive(pid)) {
    try {
      unlinkSync(file)
    } catch {}
    return null
  }
  return pid
}

export class ServerManager {
  private readonly output: vscode.OutputChannel
  private readonly onChange: () => void

  constructor(output: vscode.OutputChannel, onChange: () => void) {
    this.output = output
    this.onChange = onChange
  }

  /** Derive state from PID file — no internal mutable state. */
  getState(): DevServerState {
    const serverPath = resolveServerPath()
    if (!serverPath) return "stopped"
    return readPid(serverPath) !== null ? "running" : "stopped"
  }

  start(): void {
    const serverPath = resolveServerPath()
    if (!serverPath) {
      vscode.window.showErrorMessage("Set imagic.serverPath first")
      return
    }
    if (readPid(serverPath) !== null) {
      vscode.window.showWarningMessage("Dev server is already running")
      return
    }

    this.output.appendLine(`[dev] Starting bun dev in ${serverPath}`)
    this.output.show(true)

    const child = spawn("bun", ["dev"], {
      cwd: serverPath,
      stdio: ["ignore", "pipe", "pipe"],
      detached: true,
      env: { ...process.env, PATH: `${process.env.PATH}:${process.env.HOME}/.bun/bin` },
    })

    if (child.pid) {
      writeFileSync(pidFile(serverPath), String(child.pid))
    }

    child.stdout?.on("data", (d: Buffer) => this.output.append(d.toString()))
    child.stderr?.on("data", (d: Buffer) => this.output.append(d.toString()))

    child.on("close", (code) => {
      this.output.appendLine(`[dev] Exited with code ${code}`)
      try {
        unlinkSync(pidFile(serverPath))
      } catch {}
      this.onChange()
    })

    child.on("error", (err) => {
      this.output.appendLine(`[dev] Error: ${err.message}`)
      try {
        unlinkSync(pidFile(serverPath))
      } catch {}
      this.onChange()
    })

    // Detach — survives extension shutdown
    child.unref()
    this.onChange()
  }

  stop(): void {
    const serverPath = resolveServerPath()
    if (!serverPath) return
    const pid = readPid(serverPath)
    if (pid === null) {
      vscode.window.showWarningMessage("Dev server is not running")
      return
    }
    this.output.appendLine(`[dev] Killing PID ${pid}`)
    try {
      // Kill the process group (negative PID) since we spawned detached
      process.kill(-pid, "SIGTERM")
    } catch {
      process.kill(pid, "SIGTERM")
    }
    try {
      unlinkSync(pidFile(serverPath))
    } catch {}
    this.onChange()
  }
}
