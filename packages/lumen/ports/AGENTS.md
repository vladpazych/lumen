`packages/lumen/ports/` defines every external capability the core depends on. Optimize for narrow contracts that isolate I/O from the rest of the package.

## Rules

- Keep one port per file.
- Keep request, response, and option types next to the port that owns them.
- Import only from `../types`.
- Use aggregates here only to describe service dependencies such as `EditorPorts`.
- Keep concrete service interfaces in `../services`, not in this directory.

## Structure

- `provider.ts` defines generation and pipeline discovery contracts.
- `asset-store.ts`, `secret-store.ts`, and `logger.ts` define supporting editor-side capabilities.
- `index.ts` re-exports the port surface for package consumers.
