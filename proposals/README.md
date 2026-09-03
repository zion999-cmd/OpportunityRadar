# Proposals

Every formal change to Opportunity Radar beyond trivial maintenance
starts with a Proposal. A Proposal is a short, scoped document that
makes the *contract of change* explicit before any code is written.

## Naming

```
P0001_title.md
P0002_title.md
P0002.1_title.md   ← sub-proposal / amendment of P0002
```

- IDs are zero-padded to 4 digits.
- Filenames are lowercase, snake-or-kebab — pick one and stay
  consistent within a Proposal series.
- The first formal Proposal is `P0001 — Evidence Foundation`.

## Status

A Proposal is in exactly one status at a time:

```
Proposed       drafted, awaiting human / ChatGPT review
Approved       accepted, ready for implementation
Implementing   an implementation cycle is in progress
Completed      shipped; status frozen; subsequent changes go in a
               new Proposal
Superseded     replaced by a later Proposal (link to successor)
Rejected       declined; kept for history
```

## Required sections (template)

A Proposal must contain, at minimum:

1. **Title & ID** — `P0NNN — <title>`.
2. **Status** — one of the values above.
3. **Context** — why this Proposal exists.
4. **Goal** — one-sentence outcome.
5. **Included** — explicit, exhaustive list of what will change.
6. **NOT Included** — explicit list of what will not change, including
   adjacent things that might *seem* in scope but are not.
7. **Contract** — input shape, output shape, responsibility,
   ownership, boundary (per `CLAUDE.md` §4.3).
8. **Directory impact** — which directories are created, modified,
   or remain untouched.
9. **Dependencies** — packages, runtimes, infrastructure.
10. **Tests required** — unit / contract / regression expectations.
11. **Open questions** — anything that must be answered before
   implementation.

If a section is empty, write "None" — never leave it blank. Empty
sections are evidence of incomplete scoping.

## Invariants

- A Proposal cannot be `Implementing` until it is `Approved`.
- A Proposal cannot be `Completed` while any item in its `Included`
  list is unaddressed.
- Code that lands without a corresponding `Approved` Proposal is a
  scope violation and must be reported, not silently accepted.
- `Superseded` Proposals are kept; their `## History` section must
  link to the replacement.

## Proposal index

Every Proposal is registered in the table below the moment its
file lands. New rows are added when a Proposal is authored; the
status column is updated as the Proposal moves through its
lifecycle. **Updating `proposals/README.md` is part of the "new
Proposal" action — not a follow-up chore.** The same rule applies
on every subsequent status transition.

| ID | Title | Status | Date |
|---|---|---|---|
| P0001 | Evidence Foundation | Completed | 2026-09-03 |
| P0002 | Exploration Bridge (Agent-Neutral + Active Dispatch) | Implementing (awaiting-review) | 2026-09-03 → 2026-09-04 |

P0001 shipped the Evidence layer (contracts, normalization, Ground
Truth, SQLite substrate, repository, CLI) on 2026-09-03. Status
is frozen; subsequent changes to the Evidence layer go in a new
Proposal.

P0002 — Exploration Bridge (Agent-Neutral + Active Dispatch) is
the second Proposal. P0002 went through three iterations:

1. **Original P0002** integrated a specific Agent Runtime
   (Hermes) into the Radar domain via an `AgentExecutor` adapter
   and a `/api/ws` WebSocket client. The human identified
   mid-implementation as an **architectural ownership error** —
   "Radar owns business semantics; Agent owns execution
   mechanics." Removed.
2. **Rework #1 (Agent-neutral + Pure Ingest)** replaced the
   bridge with `bridge.ingestResult(goal, result)` and moved the
   Agent concern outside the Radar source tree. Bound by
   ADR-015.
3. **Rework #2 (Agent-neutral + Active Dispatch)** preserves
   the Agent-neutral Domain from Rework #1 and adds active
   dispatch back: Radar constructs a Goal, dispatches it
   through a thin `RuntimeAdapter` seam, ingests the returned
   Result. Hermes is the first concrete adapter under
   `runtime/hermes/`. ADR-016 records the seam.

The Rework #2 P0002 is the current state. CLI is
`explore --market <M> --question "..."` (active dispatch),
not `exploration:ingest --goal <path> --result <path>`
(pure ingest). The pre-commit report is awaiting human
review.

**Acceptance-blocked (2026-09-04):** *Resolved in the same
session.* The environmental block was cleared by adding a
small in-tree Python runner (`runtime/hermes/oneshot-runner.py`)
that forces Hermes plugin discovery in-process before invoking
`hermes_cli.oneshot`. The CLI flag surface is `hermes -z`
mirrored and lives inside `runtime/hermes/*` per ADR-016. A
second fix added a `coerceNullableIsoDatetime` normalizer for
the nullable date fields (`publishedAt`, `eventAt`): strict
ISO 8601 passes through, date-only is promoted to midnight
UTC, unparseable is collapsed to `null` (the contract allows
null for these fields; contrast with `accessedAt` which is
non-nullable and must throw on unparseable). The change is
inside `runtime/hermes/*` only. Both live CN and US runs now
return `accepted=3, rejected=0, candidates=3, sources=3`, and
a real fact (Anthropic Series H, US run) was spot-checked
end-to-end: URL accessible (HTTP 200, 147933 bytes), page
supports the claim (all key terms present), `accessedAt` is
real (date-only promotion of Hermes's local date, not a
fabricated clock), provenance matches the source page,
and the DB Evidence row is queryable via
`npm run cli -- evidence:get`. See
`proposals/P0002-exploration-bridge.md` "Hard Acceptance
Report" for the full breakdown. Status is now
`Implementing (awaiting-review)` — awaiting human authorization
to commit. **No commit has been made** (per CLAUDE.md §10).

## The next Proposal (after P0002)

P0003 is not yet scoped. Authoring it is a separate event. The
Proposal index above is the only authoritative list.
