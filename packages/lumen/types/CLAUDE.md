# packages/lumen/types/CLAUDE.md

Domain vocabulary. All types shared across the package boundary.

## Rules

- Files grouped by semantic concern: schema, generation, config.
- `index.ts` is a pure barrel — `export type` only.
- Zero deps — no imports from `../ports`, `../domain`, or `../services`.
- All types serializable (no classes, no functions) — must cross postMessage boundaries.
