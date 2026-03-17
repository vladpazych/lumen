`packages/lumen/services/` owns service factories that compose domain logic with port I/O. Optimize for actor-shaped entrypoints that stay framework-agnostic.

## Rules

- Keep one factory per actor.
- Accept port aggregates as inputs and return explicit service interfaces.
- Use domain functions for transforms and ports for effects.
- Return plain data, not VS Code, React, or other framework-specific types.

## Structure

- `editor.ts` defines the editor-facing service factory and its service interface.
