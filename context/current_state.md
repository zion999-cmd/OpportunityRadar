# Current State

> Single source of truth for "what is true right now" in this repository.
> Anything here must be supported by the actual code or by an approved
> Proposal / ADR. If a fact changes, update this file in the same change.

## Status

```
Status: Bootstrap
```

## Completed

- Project identity agreed.
- Initial opportunity model discovered through manual market scan.
- Engineering bootstrap started.

## In Progress

- Repository initialization.
- Development contract establishment.

## Next

- Review the Bootstrap.
- Design `P0001 — Evidence Foundation`.

## Blocked

- None.

## Current conceptual model

The binding conceptual model is **Five Analytical Objects + a
Validation Process**. It is non-negotiable for the lifetime of the
product.

```
Five Analytical Objects (analytical hierarchy):

  Evidence
    → Market Signal
    → Structural Shift
    → Opportunity Thesis
    → Opportunity

Validation Process (longitudinal observation):

  Validation acts on an Opportunity and its supporting
  Opportunity Thesis and Evidence over time. It is not a
  sixth equivalent object in the hierarchy.
```

Validation transitions: `created` → `strengthened` / `weakened` /
`contradicted` → `validated` / `expired`. Each transition is an
append-only event in the longitudinal record.

## Repository state (as of Bootstrap)

- `git` is initialized; no commits yet.
- Dependencies installed: `zod` (runtime); `typescript`, `vitest`,
  `@types/node` (dev). Node baseline is `>=22`.
- Scripts available: `typecheck`, `test`.
- One minimal Vitest test exists (`tests/unit/smoke.test.ts`) to prove
  the pipeline. It exercises no business concept.
- `tests/contract/` exists but is empty by design — contracts arrive
  with their owning Proposal.
- Business module directories (`evidence/`, `signals/`, `shifts/`,
  `theses/`, `opportunities/`, `review/`, `acquisition/`) **do not
  exist**. They will be created by the Proposal that owns them.

## Things this Bootstrap explicitly does NOT contain

- Evidence schema, Evidence Store, ingestion, or any acquisition
  connector (RSS, GitHub, Product Hunt, YC, news, web search, etc.).
- Market Signal, Structural Shift, Opportunity Thesis, Opportunity,
  score, ranking, watchlist, or validation logic.
- Any LLM / Agent / prompt / model-provider code.
- Any database (SQLite, PostgreSQL, Redis, vector DB), queue, scheduler,
  or cron.
- Any API surface (REST, WebSocket, MCP).
- Any UI / Workspace / dashboard.
- Any AgentFabric dependency.

If a future diff adds any of the above, that diff must cite the
governing Proposal. Without that Proposal, the diff is out of scope.
