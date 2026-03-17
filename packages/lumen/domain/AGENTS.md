`packages/lumen/domain/` owns pure business logic for `.lumen` config handling, validation, and generation polling. Optimize for data-in, data-out behavior that stays independent of adapters.

## Rules

- Keep every export here pure: no side effects, no process state, and no direct I/O.
- Import only from `../types` and `../ports`.
- Accept ports as parameters when async work is required.
- Return new values instead of mutating caller-owned config objects.
- Preserve provider-facing logic in terms of `ProviderPort`, not raw URLs or adapter clients.

## Structure

- `config.ts` parses, serializes, and mutates `.lumen` config data with immutable returns.
- `generation.ts` polls generation runs through `ProviderPort`.
- `validation.ts` holds schema and config validation helpers used by the core.
