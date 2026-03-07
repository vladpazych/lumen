---
name: review
description: "Spec compliance review. code review, check compliance. NOT: writing code, fixing issues."
context: fork
allowed-tools: ["Bash"]
argument-hint: "<scope...> [-- perspective]"
---

## Context

!`./meta/run spec --md $ARGUMENTS`

!`./meta/run lint --md $ARGUMENTS`

## Arguments

> $ARGUMENTS

Scopes before `--` select files, directories, or globs to review. Text after `--` narrows review to that perspective. No `--` = review all constraints.

No scopes or no spec cascade above → output usage: `/review <scope> [-- perspective]`

## Task

Review scopes against the spec cascade above.

Read source files in scope. Compare against the specs provided above. Lint results above are context — use to inform review, not restate.

Cap at 20 source files — if exceeded, report count and stop with "narrow scope" hint.

## Output

```
## Review: <scope>[ — <perspective>]

### Violations

| # | Location | Spec | Constraint | Evidence |
|:--|:---------|:-----|:-----------|:---------|
| 1 | file:line | CLAUDE.md path | "quoted rule" | observed behavior |

*No violations found.*

### Verdict

PASS — <n> files, 0 violations
FAIL(<n>) — <m> files, <n> violations
```

- **Location**: `path/file.ts:42` format.
- **Spec**: CLAUDE.md path from the cascade above.
- **Constraint**: verbatim quote from the spec.
- **Evidence**: what the code does that contradicts the constraint.
