# Lumen

VS Code-first tooling for vibe-coding inference pipelines on Modal, backed by a workspace home file, schema-driven `.lumen` runner configs, and a managed self-contained pipeline server.

The goal experience is simple:

1. Install the VS Code extension.
2. Create `lumen.config.json`, or run `Lumen: Init Workspace`.
3. Open it and follow the workspace setup flow.
4. Let Lumen scaffold a committed runtime into `server/` and configs into `assets/`.
5. Start vibe-coding inference pipelines with your editor and preferred LLM tools.

## What It Is

- A VS Code extension first, not a Python SDK
- A way to vibe-code inference pipelines on Modal with your preferred LLM tools
- A provider-agnostic `.lumen` file format for runner configs
- A VS Code custom editor with a first-run setup wizard
- A managed workspace bootstrap flow centered on `lumen.config.json`
- Optional starter pipeline packs and AI skill packs for pipeline authoring

## Concepts

- Lumen is extension-led. The editor is the product surface; the Python server is just the runtime it manages for you.
- `lumen.config.json` is the workspace home. Opening it becomes the setup and control surface for the whole workspace.
- A `.lumen` file is a JSON array of generation configs. Each config targets one pipeline on one live server URL.
- The VS Code extension owns the workflow: scaffold runtime files under `server/`, generate auth, start `modal serve`, discover schemas, mirror logs, and write schema snapshots.
- The Python server is intentionally small. It discovers pipeline modules, validates bearer auth, exposes pipeline schemas, and runs `generate`.
- Lumen installs default skill packs into both `.agents/skills/` and `.claude/skills/` so bring-your-own agents can work immediately.

## Quick Start

The intended user flow is:

1. Install the Lumen VS Code extension.
2. Create `lumen.config.json`, or run `Lumen: Init Workspace`.
3. Open the workspace home in VS Code.
4. Initialize the workspace. Lumen creates `server/`, `assets/`, the first `.lumen` file, and default agent skills.
5. Copy the generated auth token into a Modal secret named `lumen-auth`, or let Lumen do it if the Modal CLI is available.
6. Start the dev server from the home screen.
7. Add configs from the discovered pipelines and iterate in `assets/*.lumen`.

What this unlocks:

- scaffold a self-contained Modal server without hand-rolling project setup
- browse discovered pipeline schemas as typed forms in VS Code
- install starter pipelines such as `fal` or `z-image-turbo`
- mirror logs and schemas into workspace files for debugging and agent workflows
- install default agent skills so your LLM can help author pipelines and `.lumen` configs

If you want to try Lumen from this repo today, install the extension from source:

```sh
bun install
cd packages/vscode
bun run package
code --install-extension dist/lumen-vscode.vsix
```

The intended loop is: open VS Code, open `lumen.config.json`, let Lumen scaffold the managed workspace, then use the home screen and your editor/LLM tools to keep shaping pipelines in that workspace.

What the extension writes for you:

- `lumen.config.json` as the workspace home
- `server/` with a self-contained FastAPI + Modal server
- `assets/main.lumen` as the first runner config
- `AGENTS.md` with workspace-level guidance for agents and editors
- `server/.authkey` for local auth during development
- `server/lumen.log` for mirrored logs
- `server/lumen.schema.json` for the latest discovered pipeline schemas
- `.agents/skills/` and `.claude/skills/` with default Lumen skill packs

## Consumer Flow

Use Lumen when you want one workspace to own the whole loop:

- start from a blank workspace instead of a prebuilt backend repo
- scaffold or evolve the Modal server from the editor
- define and run generation configs in `assets/*.lumen`
- install starter pipelines such as `fal` or `z-image-turbo`
- let an LLM help vibe-code new pipelines through installed skill packs
- keep experimenting with any model provider as long as the server exposes the Lumen HTTP contract

The key positioning is simple: Lumen is a VS Code extension for managing and authoring Modal inference pipelines, with `lumen.config.json` as the workspace home, `.lumen` as the runner-config surface, and bundled skills as accelerators.

If you just want a ready-made example, open [templates/default](templates/default). It is an assembled sample project showing the scaffolded server, starter pipelines, and optional AI guidance packs together.

## Structure

- [packages/lumen](packages/lumen) contains the core types, ports, and editor-facing logic for `.lumen` files and generation flows.
- [packages/vscode](packages/vscode) contains the VS Code extension, custom editor, managed server bootstrap flow, and packaged scaffold assets.
- [templates/default](templates/default) contains an assembled example project that mirrors what the extension installs into a workspace.
- [dexter.config.ts](dexter.config.ts) contains repo-local tooling entrypoints.

## Development

```sh
bun run lint
bun x tsc --noEmit
bun test templates/default/doctor.test.ts
cd templates/default/server && uv run pytest
```

- Open [packages/vscode/README.md](packages/vscode/README.md) for the extension-specific context.
- Open [templates/default/AGENTS.md](templates/default/AGENTS.md) for the generated project model.
