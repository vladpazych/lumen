import type { ESLint, Linter } from "eslint"
import { dirname } from "node:path"
import { fileURLToPath } from "node:url"
import tsPlugin from "@typescript-eslint/eslint-plugin"
import tsParser from "@typescript-eslint/parser"
import prettierConfig from "eslint-config-prettier"
import reactPlugin from "eslint-plugin-react"
import reactHooksPlugin from "eslint-plugin-react-hooks"

export { prettierConfig }

const typescriptPlugin = tsPlugin as unknown as ESLint.Plugin
const reactEslintPlugin = reactPlugin as unknown as ESLint.Plugin
const reactHooksEslintPlugin = reactHooksPlugin as unknown as ESLint.Plugin

export const ignores: Linter.Config = {
  ignores: ["**/node_modules/**", "**/dist/**", "**/*.d.ts", "**/.vite/**"],
}

export const typescript: Linter.Config = {
  files: ["**/*.{ts,tsx}"],
  languageOptions: {
    parser: tsParser,
    parserOptions: {
      ecmaVersion: "latest",
      sourceType: "module",
      projectService: false,
    },
  },
  plugins: {
    "@typescript-eslint": typescriptPlugin,
  },
  rules: {
    ...tsPlugin.configs.recommended.rules,
    "@typescript-eslint/no-unused-vars": ["warn", { argsIgnorePattern: "^_", varsIgnorePattern: "^_" }],
    "@typescript-eslint/no-explicit-any": "warn",
    "@typescript-eslint/no-deprecated": "off",
    "@typescript-eslint/no-non-null-assertion": "warn",
    "@typescript-eslint/triple-slash-reference": "off",
    "@typescript-eslint/no-empty-object-type": "off",
  },
}

export const react: Linter.Config = {
  files: ["**/*.tsx"],
  languageOptions: {
    parserOptions: {
      ecmaFeatures: { jsx: true },
    },
  },
  plugins: {
    react: reactEslintPlugin,
    "react-hooks": reactHooksEslintPlugin,
  },
  settings: {
    react: { version: "detect" },
  },
  rules: {
    ...reactPlugin.configs.recommended.rules,
    ...reactPlugin.configs["jsx-runtime"].rules,
    ...reactHooksPlugin.configs.recommended.rules,
    "react/prop-types": "off",
    "react/no-unescaped-entities": "off",
    "react-hooks/set-state-in-effect": "off",
  },
}

export const testFiles: Linter.Config = {
  files: ["**/*.{test,spec}.{ts,tsx}", "**/test/**/*.{ts,tsx}"],
  rules: {
    "@typescript-eslint/no-explicit-any": "off",
  },
}

export function defineConfig(...configs: Linter.Config[]): Linter.Config[] {
  return [ignores, typescript, react, testFiles, ...configs, prettierConfig]
}

export function defineTypeScriptProject(
  importMetaUrl: string,
  options: {
    files: string[]
    project: string | string[]
    projectService?: boolean
  },
): Linter.Config {
  const { files, project, projectService = false } = options

  return {
    files,
    languageOptions: {
      parser: tsParser,
      parserOptions: {
        projectService,
        project,
        tsconfigRootDir: dirname(fileURLToPath(importMetaUrl)),
      },
    },
  }
}

export default defineConfig()
