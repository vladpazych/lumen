# packages/vscode/CLAUDE.md

Provider-agnostic schema-driven custom editor for `.lumen` files.

The extension owns the schema contract. Providers implement it. The file format is portable.

## Rules

### Schema contract

`shared/types.ts` is the contract: `PipelineConfig`, `ParamDefinition` (discriminated union on `type`), `GenerateResponse`. All providers produce these types — the extension renders UI from them.

Two provider models:

- **Dynamic** — HTTP server exposing `GET /pipelines`, `GET /pipelines/:id`, `POST /pipelines/:id/generate`, `GET /pipelines/:id/runs/:runId`. `lumen-example-modal` is one implementation. Add URL to `lumen.serverUrls` setting — no extension code needed.
- **Static** — schemas hardcoded in `src/providers/`, generation proxied through provider-specific APIs. fal.ai is the current static provider.

New static provider: implement `PipelineConfig[]` + a generate function returning `GenerateResponse` in `src/providers/`.

### .lumen file format

Top-level JSON array of `LumenConfig` objects. Each = `{ id, name?, service, pipeline, params }`.

```json
[
  {
    "id": "a1b2c3",
    "service": "http://localhost:8000",
    "pipeline": "txt2img",
    "params": { "prompt": "a cat" }
  },
  {
    "id": "d4e5f6",
    "name": "banana portrait",
    "service": "provider://fal",
    "pipeline": "nano-banana",
    "params": { "prompt": "a dog" }
  }
]
```

Identity is the `id` (UUID) — multiple configs for the same `service + pipeline` pair are allowed. IDs are auto-assigned on first open if missing. `name` is optional (auto-generated from pipeline display name, editable inline). Array order = display order. No metadata in file — focus index in VS Code workspace state. Old nested format auto-migrates on open.

### Build targets

Extension host: CJS, Node via `bun build` → `dist/extension.js`.
Webview: IIFE, React + Tailwind via Vite → `dist/webview/`.
Packaged: `dist/lumen-vscode.vsix`.

No `"type": "module"` in package.json — breaks VS Code CJS loading.

### Message protocol

All message types in `webview/lib/messaging.ts`. Add new messages there.

Echo prevention: `updatingFromWebview` flag skips `configsUpdated` post during extension-initiated file writes.

## Structure

- `shared/types.ts` — schema contract types (no Zod — shared between extension host and webview)
- `src/providers/` — static provider implementations
- `src/api.ts` — HTTP client for dynamic providers
- `src/provider.ts` — CustomTextEditorProvider: document parsing, messaging bridge, generation proxy
- `src/server.ts` — dev server process manager (modal-specific)
- `webview/lib/` — state reducer, typed messaging
- `webview/components/fields/` — one renderer per `ParamDefinition.type`

## Gotchas

Webview is a sandboxed iframe (`vscode-webview://` origin). All I/O through extension host via `postMessage`.

Blocked: `type="module"` (build as IIFE, rewrite to `defer`), `crossorigin` attrs (strip in HTML rewriting), `fetch`/`XHR` to external URLs, `localStorage` (use `vscode.getState()`), `eval()`, inline scripts, `navigator.clipboard`, `window.open()`.
