# packages/lumen/domain/AGENTS.md

Pure business logic. Data in, data out.

## Rules

- Pure functions: no side effects, no I/O. Ports received as parameters when async work needed.
- Import from `../types` and `../ports`. No imports from `../services` or any adapter.
- `config.ts` — .lumen file parsing, serialization, config mutation. All immutable returns.
- `generation.ts` — polling loop. Takes a `ProviderPort`, not a URL.
