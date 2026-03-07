/**
 * Dev script — watches both build targets, reinstalls the extension on change.
 * Debounces reinstall so rapid successive changes don't trigger multiple installs.
 */

import { watch } from "node:fs"
import { execSync, spawn } from "node:child_process"
import { join } from "node:path"

const distDir = join(import.meta.dirname, "dist")

// Initial build + install
console.log("[lumen-dev] initial build...")
execSync("bun run build", { stdio: "inherit" })
reinstall()

// Start watchers
spawn(
  "bun",
  [
    "build",
    "src/extension.ts",
    "--outdir",
    "dist",
    "--target",
    "node",
    "--format",
    "cjs",
    "--external",
    "vscode",
    "--sourcemap=linked",
    "--watch",
  ],
  { stdio: "inherit" },
)
spawn("bunx", ["vite", "build", "--watch"], { stdio: "inherit" })

// Watch dist/ for changes and reinstall (ignore vsix to prevent loop)
let timer: ReturnType<typeof setTimeout> | undefined
let installing = false
watch(distDir, { recursive: true }, (_event, filename) => {
  if (installing) return
  if (typeof filename === "string" && filename.endsWith(".vsix")) return
  if (timer) clearTimeout(timer)
  timer = setTimeout(() => {
    installing = true
    reinstall()
    installing = false
    timer = undefined
  }, 500)
})

function reinstall() {
  try {
    execSync("bunx @vscode/vsce package --no-dependencies -o dist/lumen-vscode.vsix", { stdio: "pipe" })
    execSync("code --install-extension dist/lumen-vscode.vsix", { stdio: "pipe" })
    console.log("[lumen-dev] reinstalled — reload window to pick up changes")
  } catch (e) {
    console.error("[lumen-dev] reinstall failed:", e instanceof Error ? e.message : e)
  }
}
