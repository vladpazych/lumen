import { dirname } from "node:path";
import { fileURLToPath } from "node:url";
import tsParser from "@typescript-eslint/parser";

const __dirname = dirname(fileURLToPath(import.meta.url));

/** @type {import("eslint").Linter.Config[]} */
export default [
  { ignores: ["dist/**", "node_modules/**"] },
  {
    files: ["src/**/*.ts"],
    languageOptions: {
      parser: tsParser,
      parserOptions: {
        projectService: false,
        project: "./tsconfig.json",
        tsconfigRootDir: __dirname,
      },
    },
  },
  {
    files: ["vite.config.ts", "dev.ts"],
    languageOptions: {
      parser: tsParser,
      parserOptions: {
        projectService: false,
        project: "./tsconfig.node.json",
        tsconfigRootDir: __dirname,
      },
    },
  },
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
];
