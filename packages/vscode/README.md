# Lumen

Lumen is a VS Code extension for experimenting with Modal inference pipelines through plain files. It turns `lumen.config.json` into a workspace home, keeps `server/` and `assets/` organized, and opens `.lumen` files in a schema-driven editor that non-developers can use.

## Quick Start

1. Install the extension and authenticate the Modal CLI on your machine with `modal token set`.
2. Create `lumen.config.json` at the root of a workspace and open it in VS Code.
3. Select `Initialize Lumen Workspace`.
4. Start the dev server from the workspace home.
5. Create or open an `assets/*.lumen` file and configure a pipeline.

## Concepts

- `lumen.config.json` is the workspace home. It owns setup, server lifecycle, pipeline creation, skill installation, and navigation.
- `server/` is committed source. It contains the Modal app, pipeline modules, and the local runtime contract.
- `assets/` is for `*.lumen` configs and generated outputs near them.
- A `.lumen` file is a JSON array of configs for one managed server. Each entry targets a pipeline and stores parameter values.

## Structure

- `server/` contains the scaffolded Modal runtime and user-owned pipelines.
- `assets/` contains `*.lumen` runner configs and generated artifacts.
- `.agents/skills/` and `.claude/skills/` contain the bundled agent skills that Lumen installs into the workspace.

## Development

- Build the extension with `bun run --cwd packages/vscode build`.
- Package a local VSIX with `bun run --cwd packages/vscode package`.
- Typecheck with `bun run --cwd packages/vscode typecheck`.
