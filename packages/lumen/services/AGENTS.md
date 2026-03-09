# packages/lumen/services/AGENTS.md

Service factories. Take port aggregates, return operation interfaces.

## Rules

- One factory per actor: `editorService(ports)` returns `EditorService`.
- Services compose domain logic with port I/O. Pure domain functions for transforms, ports for effects.
- Return plain data — no framework types (no VS Code, no React). Consumers map results to their world.
