`packages/lumen/types/` defines the shared vocabulary for every boundary around the core package. Optimize for serializable types with no inward dependencies.

## Rules

- Keep files grouped by semantic concern.
- Keep this directory dependency-free.
- Keep `index.ts` as a type-only barrel.
- Define only serializable shapes here. Do not introduce classes, functions, or framework types.

## Structure

- `schema.ts` defines pipeline schema and parameter metadata.
- `config.ts` defines `.lumen` config shapes.
- `generation.ts` defines generation run and output shapes.
- `index.ts` re-exports the shared type surface.
