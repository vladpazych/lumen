import { defineConfig, defineTypeScriptProject } from "@repo/meta-config/eslint"

export default defineConfig(
  defineTypeScriptProject(import.meta.url, {
    files: ["webview/**/*.{ts,tsx}"],
    project: "./tsconfig.webview.json",
  }),
)
