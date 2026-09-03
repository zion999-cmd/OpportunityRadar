# Current State

> Single source of truth for "what is true right now" in this repository.
> Anything here must be supported by the actual code or by an approved
> Proposal / ADR. If a fact changes, update this file in the same change.

## Status

```
Status: Evidence Foundation (P0001 Completed)
        + Exploration Bridge (P0002 Implementing — Agent-neutral
          + Active Dispatch, Hermes as first concrete adapter;
          architecture approved 2026-09-04; hard live-acceptance
          met 2026-09-04; awaiting human review of the
          hard-acceptance report and authorization to commit)
```

## Completed

- Project identity agreed.
- Initial opportunity model discovered through manual market scan.
- Engineering bootstrap started and merged (`c80f60b`).
- P0001 — Evidence Foundation: shipped, reviewed, committed.
  See `context/handoff.md` for the P0001 session summary and
  `proposals/P0001-evidence-foundation.md` for the closure report.
- P0002 — Exploration Bridge: **reworked twice**. The original
  P0002 design (Hermes WebSocket client, `AgentExecutor` adapter,
  persistent-session lifecycle, capability probe, JSON-repair
  retry) was identified by the human as an **architectural
  ownership error** and removed (Rework #1: Agent-neutral + Pure
  Ingest). Rework #1 produced the right shape (Agent-neutral
  Domain) but the wrong posture (Radar was a passive repository
  for `goal.json` + `result.json` written by an external
  operator). The current pass (Rework #2: Agent-neutral + Active
  Dispatch) keeps the Agent-neutral Domain and adds active
  dispatch back through a thin `RuntimeAdapter` seam. Hermes is
  the first concrete adapter under `runtime/hermes/`. The CLI
  is `explore --market <M> --question "..."` (active dispatch),
  not `exploration:ingest --goal <path> --result <path>`. 184/184
  tests pass, typecheck clean. Live acceptance against a real
  Hermes subprocess succeeded for both `--market US` and
  `--market CN` with `accepted=3, rejected=0, candidates=3,
  sources=3` each. One accepted fact (Anthropic Series H, US
  run) was manually spot-checked end-to-end (URL accessible,
  page supports the claim, `accessedAt` is a real date-only
  promotion, provenance matches, DB Evidence row queryable via
  `npm run cli -- evidence:get`). Awaiting human review of the
  hard-acceptance report and authorization to commit (no commit).

## In Progress

- **P0002 hard-acceptance review.** Implementation is complete
  (Rework #2). The hard live-acceptance criterion is met. The
  remaining step is the human's review of the hard-acceptance
  report in `proposals/P0002-exploration-bridge.md` "Hard
  Acceptance Report" and authorization to commit. Per
  CLAUDE.md §10, the implementer does not commit.

## Next

- P0002 review + commit (per the same workflow as P0001).
- P0003 — once P0002 is accepted, the next Proposal is the next
  object in the Five Analytical Objects chain. P0002 is
  Exploration; the next natural layer is Signal
  (Market Signal) or Observation. Neither is scoped yet.

## Blocked

**P0002 — Live acceptance on a Hermes-web-capable environment.**
**Resolved 2026-09-04.** The implementation pass is complete
and reviewable (typecheck pass, 184/184 tests pass,
architecture test pass, end-to-end Hermes adapter boundary
test pass). The full "real public-web exploration → real
Source → real EvidenceCandidate → accepted Evidence → P0001"
chain is now proven on the dev box:

- CN run: `runId=c8758109-e248-4269-b555-0f36b42611f3`,
  `status=succeeded`, `accepted=3, rejected=0, candidates=3,
  sources=3`.
- US run: `runId=aa4ec1a7-cc34-4608-877b-50221fa273f3`,
  `status=succeeded`, `accepted=3, rejected=0, candidates=3,
  sources=3`.
- One US-run fact (Anthropic Series H,
  `id=29d84a56-309b-4097-bb74-d98755eea24f`) was manually
  spot-checked end-to-end and is the first "external world →
  Evidence Store" trace the repository has produced. See
  `proposals/P0002-exploration-bridge.md` "Hard Acceptance
  Report" for the full breakdown.

The 2026-09-04 fix to clear the block was inside
`runtime/hermes/*` only (per ADR-016):

- `runtime/hermes/oneshot-runner.py` (NEW) — small in-tree
  Python helper that forces Hermes plugin discovery
  in-process before invoking `hermes_cli.oneshot.run_oneshot`.
  The plain `hermes -z` CLI does not eagerly trigger plugin
  discovery, so the bundled `web/ddgs` plugin is invisible
  to the one-shot process unless
  `_ensure_plugins_discovered(force=True)` is called first.
- `runtime/hermes/subprocess-client.ts` (MODIFIED) — spawns
  `python3 oneshot-runner.py …` instead of `hermes -z …`,
  with `HERMES_PYTHON` defaulting to
  `~/.hermes/hermes-agent/venv/bin/python3` (the Hermes venv
  Python carries the `hermes_cli` package; the system
  `python3` does not). Default timeout raised to 5 minutes.
- `runtime/hermes/adapter.ts` (MODIFIED) — `execute()` now
  passes `toolsets: 'web'` to the one-shot call so the
  AIAgent actually resolves the `web` toolset.
- `runtime/hermes/parse.ts` (MODIFIED) — added
  `coerceNullableIsoDatetime` for the nullable date fields
  (`publishedAt`, `eventAt`): strict ISO 8601 passes
  through, date-only ISO 8601 is promoted to midnight UTC,
  unparseable is collapsed to `null` (the contract allows
  null for these fields; contrast with `accessedAt` which
  is non-nullable and must throw on unparseable).

No Domain or P0001 file was modified. Four new unit tests
cover the new normalizer; all 184 tests pass.

(Previously: P0002 had a "fabricated provenance" blocker —
the Hermes adapter substituted `clock()` for unparseable
`accessedAt` values. Resolved 2026-09-04: the adapter now
REJECTS unparseable values, the bridge records the run as
`failed` with the error surfaced, and ZERO evidence is
written. Three new unit tests + one new end-to-end
integration test cover the contract. The Domain contract
`explorationResultSchema` is unchanged.)

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

P0001 implements the first object — **Evidence**. Rework #2 of
P0002 adds the **Exploration** entry point: an Agent-neutral,
actively-dispatched bridge from operator intent to Evidence
writes. The Domain is bound by ADR-015 (no Runtime by name) and
the runtime seam is bound by ADR-016 (thin `RuntimeAdapter`
boundary, replaceable). The four objects above Evidence
(Signal / Shift / Thesis / Opportunity) and the Validation
Process are still unimplemented. The §"NOT Included" lists in
each Proposal remain binding.

## Architectural ownership rework (P0002, 2026-09-03)

P0002 went through three iterations in one day:

### Iteration 1 — Original P0002 (removed)

The original P0002 integrated Hermes into the Radar domain via
an `AgentExecutor` adapter, a `/api/ws` WebSocket client, a
persistent-session lifecycle, a capability probe, and a
JSON-repair retry. The human identified this as an
**architectural ownership error**. The root cause was:

> Radar owns business semantics; Agent owns execution mechanics.

This was Rework #1's premise: the boundary was the wrong shape
— Radar should not integrate Agent internals at all.

### Iteration 2 — Rework #1 (Agent-neutral + Pure Ingest) (removed)

Rework #1 replaced the bridge with `bridge.ingestResult(goal,
result)` and moved the Agent concern outside the Radar source
tree. ADR-015 was born here. The Domain stayed neutral.
**The wrong thing about Rework #1** was the *posture*: Radar
became a passive repository for `goal.json` + `result.json`
written by an external operator. The active dispatch path
disappeared. That was Wrong B.

### Iteration 3 — Rework #2 (Agent-neutral + Active Dispatch) (current)

Rework #2 keeps the Agent-neutral Domain from Rework #1 and
adds active dispatch back. The seam is borrowed from
AgentFabric (Router → RuntimeAdapter → Concrete Runtime) but
intentionally minimal — a single method
`RuntimeAdapter.execute(goal): Promise<ExplorationResult>`. The
Hermes concrete adapter is the first one wired, under
`runtime/hermes/`. The CLI is `explore --market <M> --question
"..."`. Live acceptance against a real Hermes subprocess
succeeded for both `--market US` and `--market CN`.

The reworks are recorded in:

- **ADR-015** (binding) — Radar domain is Agent-neutral.
- **ADR-016** (NEW, Rework #2) — Runtime seam is replaceable
  and Agent-neutral; `RuntimeAdapter.execute(goal):
  Promise<Result>` is the boundary.
- **P0002 (rewritten for Rework #2)** — the Proposal in
  `proposals/P0002-exploration-bridge.md`.
- **Architecture test** —
  `tests/architecture/agent-boundary.test.ts` enforces the
  forbidden-token set on every Radar-owned Domain `.ts` file
  and on `runtime/types.ts`. The allowlist is
  `runtime/hermes/`, `scripts/cli.ts`, `runtime/index.ts`,
  and the test itself.

The previous ADRs (010/011/012/013/014) are kept in
`context/decisions.md` with explicit "Superseded by ADR-015"
or "Stale — Superseded by ADR-015" notes. ADR-015 is
preserved (it is reinforced, not superseded). ADR-016 is
the new binding rule added by Rework #2.

## Repository state (as of P0002 Rework #2 in-progress)

- Branch: `main`. The P0001 commit is `b926cec` on `main` and
  pushed. P0002 Rework #2 is the uncommitted change set on
  top.
- Runtime dependencies: `zod`, `better-sqlite3`.
- Dev dependencies: `typescript`, `vitest`, `@types/node`,
  `@types/better-sqlite3`, `tsx`.
- Node baseline: `>=22`.
- Scripts available:
  - `typecheck`, `test` (Bootstrap)
  - `db:init` (P0001) — now produces `schema_version=3`
  - `cli` (P0001 + P0002 Rework #2) — `evidence:add|get|list`
    and `explore --market <M> --question "..."`
- New directories in P0002 Rework #2:
  - `runtime/` — the Agent-neutral runtime seam
    - `runtime/types.ts` — `RuntimeAdapter`,
      `ExplorationRuntimeRouter`,
      `DefaultExplorationRuntimeRouter`
    - `runtime/index.ts` — barrel
  - `runtime/hermes/` — the Hermes concrete adapter
    - `types.ts` — `HermesClient` interface, Zod
      `HermesOneShotRequest` / `HermesOneShotResult`,
      `HermesUnavailableError`
    - `prompt.ts` — `buildHermesPrompt(goal)`
    - `parse.ts` — `extractJsonObject(stdout)`,
      `parseHermesOutput(stdout, goalId, now)`; has
      `coerceIsoDatetime` (strict ISO 8601 or date-only,
      throw on unparseable; used for `accessedAt`) and
      `coerceNullableIsoDatetime` (strict ISO 8601, date-only
      promoted to midnight UTC, unparseable collapsed to
      `null`; used for `publishedAt` and `eventAt`)
    - `subprocess-client.ts` — `HermesSubprocessClient`
      (spawns `python3 oneshot-runner.py …`, NOT
      `hermes -z …`)
    - `oneshot-runner.py` — in-tree Python helper that
      forces Hermes plugin discovery in-process before
      invoking `hermes_cli.oneshot.run_oneshot`
    - `stub-client.ts` — `HermesStubClient`
    - `adapter.ts` — `HermesRuntimeAdapter`,
      `createHermesAdapter()` (passes `toolsets: 'web'`
      to the one-shot call)
    - `index.ts` — barrel
- Modified in P0002 Rework #2:
  - `exploration/bridge/exploration-bridge.ts` — the bridge
    surface is `bridge.run(goal)`, not
    `bridge.ingestResult(goal, result)`. The bridge is
    actively dispatching; the adapter does the Runtime
    translation.
  - `exploration/repository/exploration-run-repository.ts`
    — the `startRun` recorder takes `(id, goal, runtimeId,
    startedAt)`. The `runtime_id` column is the adapter's
    public identity.
  - `storage/schema.ts` — V3 DDL added:
    `ALTER TABLE exploration_runs ADD COLUMN runtime_id TEXT
    NOT NULL DEFAULT 'unknown'`. V1 and V2 are unchanged.
  - `storage/init.ts` — `SCHEMA_VERSION` is now 3.
    `NON_IDEMPOTENT_MIGRATIONS = new Set([3])`. The runner
    catches "duplicate column name" errors per-statement and
    continues; everything else throws.
  - `scripts/cli.ts` — the CLI exposes
    `explore --market <M> --question "..." [--time-window
    ...] [--evidence-interest ...]`. The
    `exploration:ingest` subcommand is removed.
- New tests in P0002 Rework #2 (184 total now, all green):
  - 3 router unit tests
  - 4 prompt unit tests
  - 21 parse unit tests (was 17, +4 for the
    `coerceNullableIsoDatetime` rule: strict ISO 8601
    pass-through, null preservation, date-only promotion to
    midnight UTC, unparseable-to-null collapse)
  - 6 adapter unit tests
  - 3 stub-client unit tests
  - 1 subprocess-client unit test
  - 9 bridge integration tests (was 8, +1 for the real
    HermesRuntimeAdapter → real DefaultExplorationRuntimeRouter
    → real ExplorationBridge end-to-end unparseable
    `accessedAt` boundary test; uses
    `FakeAdapter` and `FakeAdapter` for the dispatch path
    in most tests, but the new boundary test wires the
    real `HermesSubprocessClient` so the contract holds
    against a real Hermes subprocess)
  - 12 run-repository integration tests (including V3
    migration from a true V2-only DB)
  - 2 architecture test cases (Domain scan +
    `runtime/types.ts` direct read)
  - The 123 P0001 + Bootstrap tests still pass
- Schema migrations:
  - V1 → V2 added the `exploration_runs` table and a
    `started_at` index. (P0001 Evidence semantics/contracts
    remain unchanged; P0002 only extends the shared
    persistence schema with `exploration_runs`.)
  - V2 → V3 added the `runtime_id` column. Non-idempotent
    `ALTER TABLE`; the migration runner handles the
    "duplicate column" error on re-run.
  - `initSchema` is now a tiny general-purpose migration
    runner; it applies pending migrations in version order
    and is idempotent (modulo the V3 carve-out).
- **Hard boundary (ADR-015 + ADR-016) — verified by an
  architecture test.**
  `tests/architecture/agent-boundary.test.ts` scans every
  `.ts` file in `evidence/`, `exploration/`, `storage/`,
  `shared/`, `runtime/` for forbidden tokens (`hermes`,
  `codex`, `claude`, `openclaw`, `AgentExecutor`,
  `AgentSendOptions`, `AgentSendResult`, `sendTurn`) and
  FAILS the suite on any match. The allowlist is
  `runtime/hermes/`, `scripts/cli.ts`, `runtime/index.ts`,
  and the test itself. On the current tree the test passes
  on every Domain file and on `runtime/types.ts`. A
  regression that re-introduces a forbidden token in the
  Domain, or a forbidden Hermes port/env/transport, fails
  the test suite.

## Things this repository explicitly does NOT contain

- Market Signal, Structural Shift, Opportunity Thesis,
  Opportunity, score, ranking, watchlist, or Validation
  logic. **P0003+ territory**, not P0001 / P0002.
- Any Agent Runtime by name in the Domain. No Hermes, no
  Codex, no Claude, no OpenClaw. Radar Domain has no
  concept of any specific Agent Runtime. The Hermes adapter
  is the only Hermes reference in the repository, and it
  lives under `runtime/hermes/`.
- Any Agent credential, transport, session, model, or tool
  ownership in the Domain. No `lsof` / `ps eww` / `/proc`
  scan, no reading `~/.hermes/.env`, no Hermes env vars in
  the Domain, no `/api/ws`, no `9119` / `9120`.
- Any `AgentExecutor` / `AgentSendOptions` /
  `AgentSendResult` / `sendTurn` surface.
- Any Agent Framework, Agent Registry, Agent Discovery,
  Agent Capability, Agent Session Protocol, Agent
  Streaming, Agent Tool Event, Agent lifecycle / credential
  / config manager in the Domain.
- AgentFabric, CBP, MCP, plugin platforms.
- Any RuntimeRegistry, Capability negotiation, multi-Runtime
  routing, failover, or load balancing in `runtime/`. The
  seam is one adapter, one router, one dispatch.
- Any automated acquisition. P0001 is manual ingest. P0002
  Rework #2 is one CLI invocation per Goal, on the
  operator's terms; no scheduler, no cron, no auto-loop.
  RSS / crawler / scraper / fixed source watchlist are
  explicitly NOT Included.
- Any full-text search, semantic search, embeddings, vector
  DB, RAG.
- Any Company / Person entity resolution, canonical entity
  graph, knowledge graph. `subject` is a free string.
- Any UI / Workspace / dashboard. P0001 + P0002 are
  headless only.
- `core/`, `engine/`, `services/`, `managers/`,
  `framework/`, `common/`, `domain/`, `platform/`,
  `agents/`, `acquisition/`, `orchestration/`. ADR-004
  keeps these out until a Proposal justifies them.

## New ADRs added in P0002

- **ADR-010** Persistent Hermes session lifecycle
  *(Stale — Superseded by ADR-015; kept as historical
  record.)*
- **ADR-011** Prompt-only JSON, one bounded repair retry,
  no regex fallback *(Stale — Superseded by ADR-015; kept
  as historical record.)*
- **ADR-012** Capability probe is the precondition for
  live acceptance *(Stale — Superseded by ADR-015; kept as
  historical record.)*
- **ADR-013** AgentExecutor boundary *(Superseded by
  ADR-015; the `AgentExecutor` surface no longer exists.)*
- **ADR-014** Amendment to ADR-013 (Hermes /api/ws
  WebSocket + credential-consumption boundary)
  *(Superseded by ADR-015; the Hermes WebSocket surface
  no longer exists, and ADR-015 is strictly stronger.)*
- **ADR-015** Radar domain is Agent-neutral — binding for
  the product lifetime. Records the principle "Radar owns
  business semantics; Agent owns execution mechanics" and
  the four concrete rules (no Agent Runtime by name in
  the Domain; no Agent credential / transport / session /
  model / tool ownership in the Domain; the boundary is a
  data shape, not a protocol; the boundary is enforced by
  the architecture test). **Reinforced by Rework #2.**
- **ADR-016** (NEW, Rework #2) **Runtime seam is
  replaceable and Agent-neutral** — `RuntimeAdapter` is
  the boundary. The seam is two interfaces and one default
  router; concrete adapters live under
  `runtime/<name>/`. A new capability (streaming, model
  metadata, session lifecycle, capability negotiation)
  requires a new ADR. A new concrete adapter does not.

(ADR-001..009 unchanged from Bootstrap + P0001.)
