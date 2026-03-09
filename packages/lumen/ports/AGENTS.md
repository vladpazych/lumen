# packages/lumen/ports/AGENTS.md

Driven port contracts. Every external capability the core depends on.

## Rules

- One file per port.
- Port-adjacent types (params, results) stay with their port.
- Import only from `../types`.
- `EditorPorts` aggregate describes what the editor service requires. Service types live in `../services/`.
