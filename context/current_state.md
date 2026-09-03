# Current State

> Single source of truth for "what is true right now" in this repository.
> Anything here must be supported by the actual code or by an approved
> Proposal / ADR. If a fact changes, update this file in the same change.

## Status

```
Status: Evidence Foundation (P0001 awaiting human review)
```

## Completed

- Project identity agreed.
- Initial opportunity model discovered through manual market scan.
- Engineering bootstrap started and merged (`c80f60b`).
- P0001 — Evidence Foundation: implemented in full per the approved
  Proposal, awaiting human review. See `context/handoff.md` for
  the session summary and `proposals/P0001-evidence-foundation.md`
  for the pre-commit report.

## In Progress

- **P0001 review.** No further code may land under P0001 until the
  human reviews the report and either accepts (`Completed`) or
  requests changes.

## Next

- P0002 — once P0001 is accepted, the next Proposal is the
  **Market Signal** layer (the second Analytical Object in the
  hierarchy). Scope must be authored; nothing has been started.
- Per ADR-005, a future Proposal that needs Prettier / ESLint /
  Node 20 / a coverage gate may add those — not before.

## Blocked

- None.

## Current conceptual model

The binding conceptual model is **Five Analytical Objects + a
Validation Process**. It is non-negotiable for the lifetime of
the product.

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

P0001 implements the first object — **Evidence** — and its
required substrate (SourceDocument, manual ingest, conservative
dedup, corroboration, append-only history). The four objects
above it are not implemented and must not be touched until their
own Proposal is approved.

Validation transitions: `created` → `strengthened` / `weakened` /
`contradicted` → `validated` / `expired`. Each transition is an
append-only event in the longitudinal record. Not implemented in
P0001; not implemented in any current Proposal.

## Repository state (as of P0001 awaiting-review)

- Branch: `main`. The P0001 change set is **uncommitted**, on top
  of Bootstrap `c80f60b`. The change set is complete and verified;
  it is awaiting human review.
- Runtime dependencies: `zod` (Bootstrap), `better-sqlite3` (P0001).
- Dev dependencies: `typescript`, `vitest`, `@types/node`,
  `@types/better-sqlite3`, `tsx` (P0001).
- Node baseline: `>=22` (Bootstrap).
- Scripts available:
  - `typecheck`, `test` (Bootstrap)
  - `db:init` — open `data/dev.db`, apply schema, print
    `schema_version=1` (P0001)
  - `cli` — `evidence:add | evidence:get | evidence:list` (P0001)
- New directories created by P0001:
  - `evidence/contracts/` — Zod schemas for `SourceDocument`,
    `Evidence`, `IngestPayload`
  - `evidence/normalization/` — `normalizeUrl`,
    `evidenceFingerprint`
  - `evidence/repository/` — `ingest` / `getById` / `list`
  - `evidence/ground-truth/` — 20 source fixtures, 36 evidence
    fixtures, contract-tested
  - `storage/` — `connection.ts` (PRAGMAs), `schema.ts` (DDL),
    `init.ts` (idempotent `initSchema`)
  - `scripts/` — `db-init.ts`, `cli.ts`
  - `data/` — gitignored DBs; only `.gitkeep` is tracked
  - `tests/contract/` — corpus integrity test
  - `tests/integration/` — repository tests + P0001 E2E acceptance
- New tests added by P0001 (84 total, all green):
  - 14 contract tests for `SourceDocument`
  - 15 contract tests for `Evidence`
  - 6 contract tests for `IngestPayload`
  - 10 normalization tests for `normalizeUrl`
  - 8 normalization tests for `evidenceFingerprint`
  - 15 corpus integrity tests
  - 13 repository integration tests
  - 1 P0001 E2E acceptance test
  - + 2 Bootstrap smoke tests (unchanged)

## Things this repository explicitly does NOT contain

- Market Signal, Structural Shift, Opportunity Thesis, Opportunity,
  score, ranking, watchlist, or Validation logic. **P0002–P0005
  territory**, not P0001.
- Any LLM / Agent / prompt / model-provider code.
- Any automated acquisition: no crawler, no scraper, no RSS, no
  browser automation, no news API, no Product Hunt / GitHub / YC
  connectors, no scheduled fetch, no automatic source discovery.
- Any full-text search system, semantic search, embeddings, vector
  database, or RAG.
- Any Company / Person entity resolution, canonical entity graph,
  or knowledge graph. `subject` is a free string in P0001.
- Any UI / Workspace / dashboard. P0001 is headless only.
- Any AgentFabric dependency, any agent runtime, any tool loop,
  any MCP runtime, any orchestration framework.
- `core/`, `engine/`, `services/`, `managers/`, `framework/`,
  `common/`, `domain/`, `platform/`, `runtime/`, `agents/`,
  `acquisition/`. ADR-004 keeps these out until a Proposal
  justifies them.

If a future diff adds any of the above, that diff must cite the
governing Proposal. Without that Proposal, the diff is out of scope.

## Outstanding design questions for P0001

P0001 §Open Questions includes ten design questions. They are
answered in `proposals/P0001-evidence-foundation.md` itself (the
"## Design Questions Answered" section added at the end of the
implementation pass). The answers are anchored to the actual
Ground Truth and the actual repository code, not to speculation
during authoring.

Key recommendations for the next Proposal author to read:

- The recurring `{ currency, amount }` shape in `metadata` is a
  first-class-field promotion candidate (P0001 Completion Report
  §Design Review).
- The recurring `{ period, growthRate }` shape is a second
  candidate.
- The 11-value `evidenceType` taxonomy in P0001 is the v1 set.
  P0002 may need to add or split types; it must do so by Proposal,
  not by silent edit.
