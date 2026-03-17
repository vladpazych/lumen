`packages/lumen/` is the framework-free core consumed by the extension and any future adapters. Optimize for one-way dependencies, plain data contracts, and pure business logic.

## Rules

- Keep this package free of framework imports and adapter code.
- Preserve the layer direction: `services` may depend on `domain`, `ports`, and `types`; `domain` may depend on `ports` and `types`; `ports` may depend only on `types`; `types` stay dependency-free.
- Keep I/O behind port contracts. Domain code receives ports as parameters instead of importing adapters.
- Return plain serializable data across package boundaries.
- Keep the public surface aligned with the package exports: `./types`, `./ports`, `./domain/config`, `./domain/generation`, `./domain/validation`, and `./editor`.

## Structure

- `types/` defines shared schema, config, and generation types.
- `ports/` defines driven port contracts and aggregates for service entrypoints.
- `domain/` defines pure config, validation, and generation logic.
- `services/` defines actor-shaped factories that orchestrate domain logic with ports.

## Verification

- Run `bun run --cwd packages/lumen typecheck` after edits in this package.
