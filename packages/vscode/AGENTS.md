`packages/vscode/` owns the VS Code extension, adapter layer, webview, and packaged scaffold assets. Optimize for a thin VS Code shell around the framework-free core in `@vladpazych/lumen`.

## Rules

- Keep domain types, business logic, and service contracts in `@vladpazych/lumen`. This package owns only adapters and VS Code-specific glue.
- Keep `src/adapters/` responsible for framework coupling such as VS Code APIs, HTTP calls, and secret access.
- Keep `src/provider.ts` as a thin `CustomTextEditorProvider` shell around `@vladpazych/lumen/editor`.
- Keep `src/extension.ts` responsible for bootstrapping adapters, server management, and command registration.
- Preserve the `.lumen` editor contract: configs are stored as a top-level array of `LumenConfig`, identity is the `id`, and array order remains user-visible order.
- Keep all webview-to-extension communication on the typed message protocol in `webview/lib/messaging.ts`.
- Keep the extension on the current build targets: CJS for the extension host and IIFE for the webview.

## Structure

- `src/adapters/` implements core ports for provider access, asset persistence, secrets, and logging.
- `src/provider.ts` owns document lifecycle, messaging, and webview coordination.
- `src/server.ts` owns the local dev server process manager.
- `src/extension.ts` wires the package together and registers commands.
- `webview/lib/` owns reducer state and typed message definitions.
- `webview/components/fields/` owns one field renderer per parameter type.
- `assets/server/base/` owns the scaffold source copied into generated workspaces.

## Verification

- Run `bun run --cwd packages/vscode typecheck` after edits in this package.
- Run `bun run --cwd packages/vscode build` after changes to bundling, entrypoints, or webview assets.

## Gotchas

- VS Code loads the extension host bundle as CJS. Do not add `"type": "module"` to this package.
- The webview runs in a sandboxed `vscode-webview://` iframe. Route I/O through the extension host and avoid blocked browser APIs such as external `fetch`, `localStorage`, `eval`, inline scripts, `navigator.clipboard`, and `window.open()`.
- Keep echo prevention intact when extension-initiated writes flow back through the webview messaging bridge.
