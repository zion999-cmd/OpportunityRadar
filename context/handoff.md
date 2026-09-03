# Handoff — P0001 Evidence Foundation session

This is the most recent session summary. It is **not** a forecast; it is
a snapshot of what the last implementer (Claude Code) actually did, the
real state of the verification, and the things the next session should
read first.

## Current state

- Project status: **Evidence Foundation (P0001 awaiting human review)**.
- The P0001 change set is **uncommitted** on top of Bootstrap
  `c80f60b`. It is complete and verified; the human reviews and
  decides when to commit.
- No commit has been made for P0001. Per CLAUDE.md §10 and the
  P0001 Proposal's own "Pre-Commit Report" section, this is the
  intended workflow.

## What P0001 delivered

End-to-end. All ten phases of the approved implementation plan
landed; nothing was deferred.

| Area | Result |
|---|---|
| Contracts | 3 Zod schemas (`SourceDocument`, `Evidence`, `IngestPayload`) + barrel |
| Normalization | `normalizeUrl` (conservative) + `evidenceFingerprint` (sha256) |
| Ground Truth corpus | 20 source-document fixtures, 36 evidence fixtures, all 11 evidenceType categories, atomicity + corroboration gates green |
| Storage substrate | `better-sqlite3` + WAL + foreign_keys + busy_timeout, idempotent `initSchema`, `schema_version` table |
| Repository | `ingest` (atomic, with dedup + corroboration), `getById`, `list` |
| CLI | `evidence:add` / `evidence:get` / `evidence:list [--market] [--type]`, run via `tsx` |
| Tests | 84 / 84 green; typecheck clean |
| ADRs | 006 (better-sqlite3), 007 (many-to-many), 008 (fingerprint), 009 (tsx reintroduction) |
| Project memory | `current_state.md`, `decisions.md`, `handoff.md` all updated |
| Proposal status | P0001 flipped to `awaiting-review` |

## Architectural boundaries established (load-bearing for the next session)

1. **Five Analytical Objects + Validation Process is binding.** P0001
   only implements **Evidence**. Market Signal, Structural Shift,
   Opportunity Thesis, Opportunity, and Validation are NOT
   implemented and must not be touched until their own Proposal
   is approved.
2. **Evidence ↔ SourceDocument is many-to-many.** See ADR-007. The
   join table `evidence_sources` is not optional. Any future
   migration that collapses it is a regression.
3. **The Evidence fingerprint is the dedup key.** See ADR-008.
   Two facts that share `(subject, claim, eventAt, market)`
   collide on a single Evidence row. Paraphrase / entity dedup is
   future work and must not be silently added.
4. **Append-only.** Contradicting claims get *separate* Evidence
   rows (different fingerprints); the older row is never
   overwritten. The repository test
   `preserves contradicting claims as separate evidence`
   enforces this.
5. **Manual ingest only.** No crawler, no scraper, no API, no
   scheduled fetch, no automatic source discovery. P0001 ships a
   CLI that reads a JSON file; the JSON file is human-curated.
6. **No `src/`, no `core/`, no `engine/`, no `services/`, no
   `managers/`, no `framework/`, no `common/`, no `domain/`, no
   `platform/`, no `runtime/`, no `agents/`, no `acquisition/`.**
   New directories appear only via an owning Proposal.
7. **The repository does not own the DB connection.** Every
   exported function takes a `SqliteDatabase`. There is no
   singleton. Tests, scripts, and any future runtime caller all
   share the same explicit "open then use" pattern.
8. **Truth priority** (CLAUDE.md §5): actual code >
   runtime/test evidence > approved Proposal / ADR > context
   summary.
9. **No auto-commit.** The current task explicitly forbade
   committing. The next implementer must continue that rule until
   the human says otherwise.

## Verification — the exact commands to re-run

```
npm install
npm run typecheck       # tsc --noEmit, exit 0
npm test                # vitest run, 84 / 84
rm -f data/dev.db*      # fresh DB
npm run db:init         # schema_version=1
npm run cli -- evidence:add data/example.json
npm run cli -- evidence:get ev-example-wonderful-funding
npm run cli -- evidence:list --market US
```

All commands above are expected to succeed. Output snippets are
captured in the P0001 Completion Report.

## Known risks / open items

- **P0001 is uncommitted.** If the human accepts the report, the
  implementer of the next session may be asked to commit. Until
  then, the working tree is the change set.
- **No coverage gate.** P0001 ships 84 tests; the 80% minimum in
  `CLAUDE.md` §8 is not enforced for Bootstrap and is not yet
  enforced for P0001. The first Proposal that introduces
  continuous-integration (P0006 or later) should add the gate.
- **`metadata` is the promotion-candidate zone.** The Design
  Review in the P0001 Completion Report lists the recurring
  shapes (currency + amount, period + growthRate) that should
  be promoted to first-class fields in a future Proposal.
  Promotion is a contract change and must be Proposal-driven.
- **The 11-value `evidenceType` taxonomy is v1.** If P0002
  (Market Signal) needs a 12th type, that is a contract change
  in P0002's Proposal. The corpus integrity test will need to
  be updated to require the new type.
- **`sourceNote` is still absent.** P0001 §Open Questions Q2
  asked whether `SourceDocument` should carry a free-text note.
  P0001 left this out. If a future Proposal needs it, it adds
  it; P0001 does not pre-empt.
- **No formatter, no linter, no CI.** Style drift between
  sessions is still possible. Deferred per ADR-005.
- **`subject` is a free string.** Entity resolution is
  explicitly out of scope for P0001 (and is in the NOT-Included
  list). If P0002 (Market Signal) needs canonical entities, that
  is a P0002 concern.

## What the next session should read first

In order:

1. `CLAUDE.md` (binding operating manual).
2. `context/current_state.md` (this file's sibling).
3. `context/decisions.md` (ADRs 001–009; read 002, 004, 006–009
   especially).
4. `proposals/P0001-evidence-foundation.md` (the spec; especially
   the Included / NOT Included / Open Questions / Pre-Commit
   Report sections).
5. The P0001 Completion Report at the end of the Proposal
   document (the deliverable).
6. `evidence/ground-truth/README.md` (the closed corpus).
7. The `evidence/repository/evidence-repository.ts` source — it
   is the only write path for Evidence, and it is small (~250
   lines).

## Next proposed step

> **P0001 is ready for human review.** The implementer of the
> next session should not start P0002 until the human has
> accepted P0001 and the change set has been committed.
