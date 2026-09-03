# Handoff — P0002 Exploration Bridge session (Agent-neutral + Active Dispatch)

This is the most recent session summary. It is **not** a forecast; it is
a snapshot of what the last implementer (Claude Code) actually did, the
real state of the verification, and the things the next session should
read first.

## Current state

- Project status: **P0002 (Exploration Bridge) Implementing —
  Agent-neutral + Active Dispatch; architecture approved
  2026-09-04; hard live-acceptance met 2026-09-04; awaiting
  human review of the hard-acceptance report and authorization
  to commit.** P0002 went through three iterations in one day
  (original Hermes-in-Domain → Rework #1 Pure Ingest → Rework #2
  Active Dispatch). The current state is Rework #2. The Domain
  is **Agent-neutral** (ADR-015). The runtime seam is
  **replaceable and Agent-neutral** (ADR-016). A real Hermes
  subprocess is the first concrete adapter under
  `runtime/hermes/`.
- P0001 is on `main` as commit `b926cec` (Evidence Foundation).
  P0002 Rework #2 is the uncommitted change set on top of
  `b926cec`.
- **184/184 tests pass**, typecheck clean. The end-to-end
  Hermes adapter boundary test (real `HermesRuntimeAdapter` →
  real `DefaultExplorationRuntimeRouter` → real
  `ExplorationBridge`) is green: an unparseable `accessedAt`
  is rejected, the run is recorded as `failed`, the error is
  surfaced, and ZERO evidence is written. Live acceptance
  against a real Hermes subprocess returned `succeeded` for
  both `--market US` and `--market CN` with
  `accepted=3, rejected=0, candidates=3, sources=3` (after the
  2026-09-04 pass that added `runtime/hermes/oneshot-runner.py`
  to force plugin discovery and
  `coerceNullableIsoDatetime` for the nullable date fields).
  One accepted fact (Anthropic Series H, US run) was manually
  spot-checked end-to-end: URL accessible (HTTP 200, 147933
  bytes), page supports the claim (all key terms present),
  `accessedAt` is a real date-only promotion (not a
  fabricated clock), provenance matches, and the DB Evidence
  row is queryable via `npm run cli -- evidence:get`. **No
  commit has been made for P0002.** Per the Proposal's
  pre-commit rule, the human reviews the hard-acceptance
  report in `proposals/P0002-exploration-bridge.md` "Hard
  Acceptance Report" and decides when to commit.

## What P0002 (Rework #2) delivered

The reworked P0002 is an end-to-end, Agent-neutral, actively
dispatching Exploration Bridge. The full flow is: operator CLI
flags → Goal → bridge.run(goal) → router.dispatch(goal) →
HermesRuntimeAdapter.execute(goal) → Hermes subprocess →
ExplorationResult → bridge ingest → P0001 Evidence rows →
exploration_runs RunRecord.

| Area | Result |
|---|---|
| **Status** | `Implementing`; Rework #2 supersedes Rework #1 (Pure Ingest). |
| **Contracts** | `exploration/contracts/{exploration-goal, evidence-candidate, exploration-result, index}.ts` — 39 unit-contract tests, typecheck clean. |
| **Agent-neutral Domain (ADR-015)** | `tests/architecture/agent-boundary.test.ts` — 2 architecture tests that scan every `.ts` file in `evidence/`, `exploration/`, `storage/`, `shared/`, `runtime/` for forbidden tokens; allowlist is `runtime/hermes/`, `scripts/cli.ts`, `runtime/index.ts`, and the test itself. |
| **Runtime seam (ADR-016)** | `runtime/types.ts` — `RuntimeAdapter`, `ExplorationRuntimeRouter`, `DefaultExplorationRuntimeRouter`. Two interfaces, one default router, no capabilities beyond "Goal in, Result out". |
| **Hermes concrete adapter** | `runtime/hermes/` — `HermesRuntimeAdapter` (`runtimeId='hermes'`), `buildHermesPrompt`, `extractJsonObject` + `parseHermesOutput`, `HermesSubprocessClient`, `HermesStubClient`. 26 new unit tests. |
| **Bridge** | `exploration/bridge/exploration-bridge.ts` — surface is `bridge.run(goal)`. The bridge Zod-revalidates the Result, refuses `goalId` mismatch, applies the provenance gate per candidate, ingests accepted candidates through P0001, and records the run. 8 integration tests using a `FakeAdapter`. |
| **Run repository** | `exploration/repository/exploration-run-repository.ts` — SQLite-backed `RunRecorder`; the `runtime_id` column records the adapter's public identity. 12 integration tests (including a V3 migration test from a true V2-only DB). |
| **V3 schema migration** | `storage/schema.ts` V3 DDL adds `runtime_id` via `ALTER TABLE ADD COLUMN`. `storage/init.ts` treats V3 as best-effort (catches "duplicate column" errors on re-run). `SCHEMA_VERSION` is now 3. |
| **CLI `explore` subcommand** | `scripts/cli.ts` — `npm run cli -- explore --market <M> --question "..."`. The CLI is the only place that constructs a Goal from CLI flags, instantiates `HermesRuntimeAdapter`, wires the default router, opens the SQLite DB, and calls `bridge.run(goal)`. The `exploration:ingest` subcommand (Rework #1) is removed. |
| **Live acceptance** | A real Hermes subprocess produced Results for `--market US` and `--market CN`; P0001 Evidence rows were written; `exploration_runs` records `runtime_id='hermes'`. |
| **ADRs** | 010–014 retained as historical records with explicit supersession notes. **015** preserved and reinforced. **016 (NEW) Runtime seam is replaceable and Agent-neutral** is the new binding rule added by Rework #2. |
| **Project memory** | `context/current_state.md`, `context/decisions.md`, `proposals/README.md`, this handoff — all updated to reflect Rework #2 ("Agent-neutral + Active Dispatch", Hermes under `runtime/hermes/`, CLI is `explore`, not `ingest`). |

## Architectural boundaries established (load-bearing for the next session)

1. **Five Analytical Objects + Validation Process is binding.** P0002
   adds the Exploration entry point but does **not** implement any
   of the four higher objects. Signal / Shift / Thesis / Opportunity
   and Validation remain unimplemented.
2. **Radar Domain is Agent-neutral (ADR-015).** No Radar Domain
   module may import, name, depend on, or test against a specific
   Agent Runtime (Hermes, Codex, Claude, OpenClaw, anything), or
   expose the old `AgentExecutor` / `AgentSendOptions` /
   `AgentSendResult` / `sendTurn` surface.
3. **Runtime seam is replaceable and Agent-neutral (ADR-016).**
   `RuntimeAdapter.execute(goal): Promise<ExplorationResult>` is
   the boundary. The seam is intentionally thin — no capability
   negotiation, no model metadata, no session lifecycle, no
   streaming, no tool events, no token accounting. Adding any of
   these to the seam requires a new ADR.
4. **Concrete adapters live in their own directory.**
   `runtime/hermes/` today. `runtime/<name>/` for future
   adapters. Each adapter is allowed to depend on its Runtime's
   internals; the architecture test does not scan adapter
   directories.
5. **Composition root is `scripts/cli.ts`.** The only file that
   wires a concrete adapter. Adding a new adapter is a one-line
   wiring change in the CLI plus a new `runtime/<name>/`
   directory.
6. **Provenance gate (P0002 §6).** Every candidate must have a
   non-empty URL. Candidates without one are counted as
   `rejected`, never as a `failed` run. The bridge then attempts
   P0001 ingest; P0001's stricter URL validation is the second
   gate.
7. **P0001 dedup is reused.** The bridge builds a P0001
   `IngestPayload` per candidate. P0001 owns the source / evidence
   dedup; the bridge does not duplicate that logic.
8. **No automation, no scheduler, no UI.** P0001 is manual ingest.
   P0002 is one CLI invocation per Goal. No cron, no watch, no
   API.
9. **Truth priority** (CLAUDE.md §5): actual code > runtime/test
   evidence > approved Proposal / ADR > context summary.
10. **No auto-commit.** The current task explicitly forbade
    committing. The next implementer must continue that rule until
    the human says otherwise.

## Verification — the exact commands to re-run

```
npm install
npm run typecheck                                                  # exit 0
npm test                                                           # 184 / 184
npx vitest run tests/architecture/agent-boundary.test.ts           # 2 / 2
npx vitest run tests/unit/exploration/                             # 39 / 39
npx vitest run tests/unit/runtime/                                 # 30 / 30
npx vitest run tests/integration/exploration-bridge.test.ts        # 9 / 9
npx vitest run tests/integration/exploration-run-repository.test.ts # 12 / 12
npx tsx scripts/cli.ts help                                         # usage text
npx tsx scripts/cli.ts explore --help                              # usage text

# Live acceptance (requires `hermes` on PATH; the architecture
# test and unit tests do NOT depend on it):
npx tsx scripts/cli.ts db:init
npx tsx scripts/cli.ts explore --market US --question "List 3 recent AI product launches or funding rounds in the United States, each backed by a publicly retrievable source URL and a strict ISO 8601 accessedAt timestamp."
npx tsx scripts/cli.ts explore --market CN --question "List 3 recent AI product launches or funding rounds in China, each backed by a publicly retrievable source URL and a strict ISO 8601 accessedAt timestamp."
```

## How a Hermes capability talks to Radar (today)

The composition root (`scripts/cli.ts`) is the only place that
wires the Hermes adapter. A second adapter is a one-line
wiring change plus a new `runtime/<name>/` directory; the
Domain does not change.

For Hermes specifically, the call is:

```ts
const client = process.env.HERMES_CLIENT === 'stub'
  ? new HermesStubClient()
  : new HermesSubprocessClient();
const adapter = new HermesRuntimeAdapter(client);
const router = new DefaultExplorationRuntimeRouter(adapter);
const bridge = createExplorationBridge({ db, router, runtimeId: adapter.runtimeId, … });
```

The adapter takes no credentials. The Hermes CLI is expected to
be installed and on `PATH`; `HermesSubprocessClient.isAvailable()`
probes `hermes --version` at startup.

## Known risks / open items

1. **No coverage gate.** 184 tests but no enforced minimum.
   CLAUDE.md §8 names 80%; P0001 + P0002 don't add it. The
   first Proposal that introduces CI should add the gate.
2. **No second adapter.** The composition root instantiates
   exactly one adapter. A Proposal that wants Codex, Claude,
   OpenClaw, etc. is the first one to add a second; that
   Proposal may add selection logic at the same time, but
   it is out of scope here.
3. **Live acceptance needs `hermes` on `PATH`.** The
   architecture test and unit tests do not. CI without
   `hermes` cannot run live acceptance. A future Proposal
   may add a CI-friendly stub-only test gate. As of
   2026-09-04, the dev box has a working `web/ddgs`
   provider; the in-tree
   `runtime/hermes/oneshot-runner.py` forces plugin
   discovery in-process to avoid the `hermes -z` CLI
   quirk. If `hermes` is upgraded and the discovery
   mechanism changes, the runner is the file to update.
4. **Hermes prompt shape is a contract.** The current
   `buildHermesPrompt` asks for a JSON object on the last
   line of Hermes's reply. A Hermes upgrade that changes the
   output format is a `parse.ts` change; the Domain
   contracts do not change.
5. **`metadata` promotion.** P0001's Design Review listed two
   recurring shapes (`{ currency, amount }`, `{ period,
   growthRate }`) as first-class-field candidates. P0002
   Rework #2 did not promote them; the live-acceptance
   results show more shapes worth promoting (e.g. the
   Anthropic candidate carries `valuationAmount`,
   `valuationCurrency`, `roundLabel`, `leadInvestors[]`
   inside the `claim` string). Promotion is a contract
   change, by Proposal.
6. **`evidenceType` taxonomy is v1 (11 types).** Live
   acceptance is producing `funding` and `product_launch`
   values. If a fact type P0001/P0002 cannot classify
   surfaces, the next Proposal adds the 12th value. The
   corpus integrity test in P0001 will need to be updated
   to require the new type.
7. **No formatter, no linter, no CI.** Style drift is still
   possible. Deferred per ADR-005.
8. **`sourceNote` is still absent.** The P0001 §Open
   Questions Q2 question is still open. If a future Proposal
   needs it, that Proposal adds it; P0002 Rework #2 did not.
9. **The hard-acceptance report is the next human input.**
   The human reviews the report in
   `proposals/P0002-exploration-bridge.md` "Hard Acceptance
   Report" and either authorizes `git commit` for the
   P0002 scope or returns specific findings. The
   implementer does not commit.

## What the next session should read first

In order:

1. `CLAUDE.md` (binding operating manual).
2. `context/current_state.md` (this file's sibling).
3. `context/decisions.md` — **read ADR-015 (binding, Domain
   neutrality) and ADR-016 (NEW, runtime seam boundary) and
   the supersession notes on ADR-010..014**.
4. `proposals/P0002-exploration-bridge.md` (the Rework #2
   spec, especially the "Architecture" section, the
   "Boundary (binding — ADR-015 + ADR-016)" section, the
   "NOT Included" section, the "ADR handling" section, and
   the "Success criteria" section).
5. `proposals/P0001-evidence-foundation.md` (the frozen
   contract surface P0002 reuses).
6. `runtime/types.ts` (the Agent-neutral runtime seam).
7. `exploration/bridge/exploration-bridge.ts` (the only
   write path for Evidence from a Goal).
8. `exploration/contracts/exploration-goal.ts` +
   `exploration/contracts/exploration-result.ts` +
   `exploration/contracts/evidence-candidate.ts` (the
   Agent-neutral contracts).
9. `exploration/repository/exploration-run-repository.ts`
   (the run-record persistence).
10. `runtime/hermes/adapter.ts` (the Hermes concrete
    adapter; the seam to swap when a second adapter
    appears).
11. `tests/architecture/agent-boundary.test.ts` (the test
    that enforces ADR-015 and ADR-016).

## Next proposed step

> **P0002 Rework #2 (Agent-neutral + Active Dispatch)
> implementation is complete.** The hard live-acceptance
> report is in
> `proposals/P0002-exploration-bridge.md` "Hard Acceptance
> Report". The human reviews it and decides when to commit
> P0002 to `main`. Per CLAUDE.md §10 ("Do not auto-commit"),
> the implementer does not commit; the human authorizes
> `git commit` for the P0002 scope.
>
> The next implementer should not add any Agent-specific
> surface to the Radar Domain. A future Proposal that
> wants to wrap a second Agent Runtime (Codex, Claude,
> OpenClaw, anything) does so by adding a new
> `runtime/<name>/` directory and a one-line wiring change
> in `scripts/cli.ts`. The Domain does not change.
> A future Proposal that wants to add a new capability to
> the runtime seam (streaming, capability negotiation,
> session lifecycle, model metadata, token accounting)
> must arrive with its own ADR.
