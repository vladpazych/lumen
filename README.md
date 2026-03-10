# Lumen

Schema-driven `.lumen` files for image and video generation, plus a VS Code editor that can scaffold and manage a self-contained Modal pipeline server.

```json
[
  {
    "id": "hero-shot",
    "name": "Hero Shot",
    "service": "https://your-server.modal.run",
    "pipeline": "echo",
    "params": {
      "prompt": "Studio portrait, soft rim light, 85mm lens"
    }
  }
]
```

```sh
bun install
cd packages/vscode
bun run package
code --install-extension dist/lumen-vscode.vsix
```

## What It Is

- A provider-agnostic `.lumen` file format for generation configs
- A VS Code custom editor that renders pipeline schemas as typed forms
- A managed server bootstrap flow that installs a self-contained Modal server into your workspace
- Optional starter pipeline packs and AI skill packs for pipeline authoring

## Concepts

- A `.lumen` file is a JSON array of generation configs. Each config targets one pipeline on one live server URL.
- The VS Code extension owns the workflow: scaffold server files, generate auth, start `modal serve`, discover schemas, mirror logs, and write schema snapshots.
- The Python server is intentionally small. It discovers pipeline modules, validates bearer auth, exposes pipeline schemas, and runs `generate`.
- Skill packs are optional. Lumen can install them into `.agents/skills/` so any LLM tool you use can help evolve pipelines or `.lumen` files.

## Quick Start

Today the easiest way to try Lumen from this repo is from source:

```sh
bun install
cd packages/vscode
bun run package
code --install-extension dist/lumen-vscode.vsix
```

Then in any workspace:

1. Create a `.lumen` file with `[]`.
2. Open it in VS Code. The Lumen custom editor will show the setup panel.
3. Choose where to install the managed server, whether to initialize git, and which starter pipeline packs and skill packs to install.
4. Copy the generated auth token into a Modal secret named `lumen-auth`, or use the button in the editor if the Modal CLI is available.
5. Start the dev server from the editor.
6. Add configs from the discovered pipelines and iterate in the same `.lumen` file.

What the extension writes for you:

- `server/` with a self-contained FastAPI + Modal server
- `server/.authkey` for local auth during development
- `server/lumen.log` for mirrored logs
- `server/lumen.schema.json` for the latest discovered pipeline schemas
- `.agents/skills/` if you selected optional skill packs

## Consumer Flow

Use Lumen when you want one workspace to own the whole loop:

- define generation configs in `.lumen`
- scaffold or evolve the Modal server from the editor
- install starter pipelines such as `fal` or `z-image-turbo`
- let an LLM help author new pipelines through installed skill packs
- keep experimenting with any model provider as long as the server exposes the Lumen HTTP contract

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
