import { dirname } from "node:path"
import { fileURLToPath } from "node:url"
import tsParser from "@typescript-eslint/parser"
import { ignores, typescript, react, testFiles, prettierConfig } from "@asombro/toolchain/eslint"

const __dirname = dirname(fileURLToPath(import.meta.url))

/** @type {import("eslint").Linter.Config[]} */
export default [
  ignores,
  typescript,
  react,
  testFiles,
  {
    files: ["webview/**/*.{ts,tsx}"],
    languageOptions: {
      parser: tsParser,
      parserOptions: {
        projectService: false,
        project: "./tsconfig.webview.json",
        tsconfigRootDir: __dirname,
      },
    },
  },
  prettierConfig,
]
