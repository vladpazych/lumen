# packages/vscode/AGENTS.md

VS Code custom editor for `.lumen` files. Bootstraps `@lumen/core`, wires adapters, owns the webview.

## Rules

### Architecture

- Domain types, ports, and services live in `@lumen/core`. This package implements adapters and VS Code glue.
- `src/adapters/` implement `@lumen/core/ports` contracts. Each adapter owns its framework coupling (VS Code APIs, fal.ai REST, HTTP fetch).
- `src/provider.ts` is the `CustomTextEditorProvider` — thin shell that delegates to `EditorService` from `@lumen/core/editor`.
- `src/extension.ts` bootstraps: creates adapters, wires the service, registers commands.

### Providers

Two adapter models, both implement `ProviderPort`:

- **HTTP** (`src/adapters/http-provider.ts`) — wraps `GET /pipelines`, `POST /pipelines/:id/generate`, `GET /pipelines/:id/runs/:runId`. Add server URL to `lumen.servers` setting.
- **fal.ai** (`src/adapters/fal-provider.ts`) — built-in schemas, fal.ai REST API, image upload to fal CDN. Activated when API key is set.

### .lumen file format

Top-level JSON array of `LumenConfig` objects. Each = `{ id, name?, service, pipeline, params }`.

Identity is the `id` (UUID). IDs auto-assigned on first open if missing. `name` is optional. Array order = display order. Focus index in VS Code workspace state. Old nested format auto-migrates on open.

### Build targets

Extension host: CJS, Node via `bun build` → `dist/extension.js`.
Webview: IIFE, React + Tailwind via Vite → `dist/webview/`.

No `"type": "module"` in package.json — breaks VS Code CJS loading.

### Message protocol

All message types in `webview/lib/messaging.ts`. `DevServerState` defined there — VS Code-specific, not in core.

Echo prevention: `updatingFromWebview` flag skips `configsUpdated` post during extension-initiated file writes.

## Structure

- `src/adapters/` — port implementations (`ProviderPort`, `AssetStorePort`, `SecretStorePort`, `LoggerPort`)
- `src/provider.ts` — `CustomTextEditorProvider`: document lifecycle, messaging bridge, webview management
- `src/server.ts` — dev server process manager
- `src/extension.ts` — bootstrap and command registration
- `webview/lib/` — state reducer, typed messaging
- `webview/components/fields/` — one renderer per `ParamDefinition.type`

## Gotchas

Webview is a sandboxed iframe (`vscode-webview://` origin). All I/O through extension host via `postMessage`.

Blocked: `type="module"` (build as IIFE, rewrite to `defer`), `crossorigin` attrs (strip in HTML rewriting), `fetch`/`XHR` to external URLs, `localStorage` (use `vscode.getState()`), `eval()`, inline scripts, `navigator.clipboard`, `window.open()`.
