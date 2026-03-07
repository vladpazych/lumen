# packages/lumen/CLAUDE.md

Hexagonal core — domain types, port contracts, pure logic, service orchestration.

No runtime dependencies. No framework imports. Consumed by bundlers.

## Rules

### Layers

- Types: domain vocabulary. Zero deps inside the package.
- Ports: driven port contracts. Import only from `../types`.
- Domain: pure business logic. Import from `../types` and `../ports`. No I/O — ports received as function parameters.
- Services: actor-shaped factories. Take port aggregates, return service interfaces. Direction: services → domain → types. Never reversed.

### Package exports

- `./types` — domain vocabulary.
- `./ports` — driven port contracts and actor aggregates.
- `./domain/config` — .lumen file parsing and config manipulation.
- `./domain/generation` — generation polling logic.
- `./editor` — editor service factory.

## Structure

```
types/        schema, generation response, config — serializable across any boundary
ports/        provider, asset store, secret store, logger — one file per port
domain/       config parsing, generation polling — pure functions, no I/O
services/     editor service — orchestrates ports for the editor lifecycle
```
