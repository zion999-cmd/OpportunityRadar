# Decisions (ADRs)

This file records binding architecture decisions for Opportunity Radar.
Each ADR is short, dated, and reasoned. New ADRs are appended; existing
ADRs are not edited in place. To change a decision, write a new ADR
that supersedes the old one and link both.

Numbering: `ADR-NNN — short title`. New ADRs continue from the highest
existing number.

---

## ADR-001 — Opportunity Radar is independent from AgentFabric

**Date:** Bootstrap
**Status:** Accepted

**Decision.** Opportunity Radar is its own repository and its own
product. AgentFabric is not a current dependency and is not imported
into this codebase.

**Reasoning.** AgentFabric is a separate product with its own
architecture cadence. Coupling Opportunity Radar to it would let
AgentFabric's release rhythm and abstractions drive the Radar product,
which is a single-product opportunity intelligence tool, not a generic
agent platform.

**Consequences.**

- AgentFabric may be adopted later as an *optional* external runtime by
  an explicit Proposal, but that is a future ADR event, not a current
  assumption.
- No code in this repository may `import` from an AgentFabric path.

---

## ADR-002 — Five Analytical Objects are separate concepts; Validation is a process, not a sixth object

**Date:** Bootstrap
**Status:** Accepted

**Decision.** The conceptual model is **Five Analytical Objects + a
Validation Process**. The five analytical objects — Evidence, Market
Signal, Structural Shift, Opportunity Thesis, Opportunity — are kept
semantically separate. They are not unified into a generic
`Insight` / `Item` / `Record` / `Node` type, and they do not share a
single mutable blob. Validation is **not** a sixth equivalent object in
the analytical hierarchy; it is a longitudinal process that observes
an Opportunity and its supporting Thesis / Evidence.

**Reasoning.** Each analytical object has a different confidence
profile, a different lifetime, and a different author. Collapsing them
destroys provenance, makes append-only history ambiguous, and confuses
downstream consumers (e.g. validation, scoring, review). Treating
Validation as a sixth equivalent object hides the fact that it is a
process over time, not a layer in the chain.

**Consequences.**

- A future Proposal that introduces any of the five analytical objects
  must define it on its own.
- A future Proposal that introduces the Validation process must define
  it as an append-only event source over an Opportunity, not as a
  sixth object that holds a single mutable state.
- Cross-object relationships are expressed through explicit references,
  not by merging types.
- Provenance from any object up to Evidence must remain reconstructable,
  including the Evidence that drives Validation transitions.

---

## ADR-003 — China primary, US leading indicator

**Date:** Bootstrap
**Status:** Accepted (observation hypothesis)

**Decision.** The current primary execution / commercialization market
for Opportunity Radar is **China**. The current primary leading-indicator
market is the **United States**.

**Reasoning.** Many China opportunity patterns appear in the US market
first. Surfacing them earlier gives the Radar more lead time. This is
a strategic observation hypothesis, not an algorithm constant.

**Consequences.**

- A 6–18 month lead is treated as a working observation, not a
  hard-coded business rule.
- Future expansion to additional geographies requires a new ADR.
- Acquisition, scoring, and review strategies may bias toward US-sourced
  Evidence and China-executable Opportunities, but only via an owning
  Proposal.

---

## ADR-004 — No platform, no runtime, no shared infrastructure in Bootstrap

**Date:** Bootstrap
**Status:** Accepted

**Decision.** Opportunity Radar is a concrete product, not a platform.
It does not self-host an Agent Runtime, a workflow engine, a vector
database, an ETL pipeline, or a generic RAG / knowledge-graph layer
during Bootstrap.

**Reasoning.** Each of those abstractions has its own design space and
its own failure modes. Importing them now, before the Radar's first
real business module exists, would lock in choices that have not yet
been justified by concrete load, concrete contracts, or concrete
ownership.

**Consequences.**

- `core/`, `engine/`, `services/`, `managers/`, `framework/`,
  `common/`, `domain/`, `platform/`, `runtime/`, `agents/`,
  `acquisition/` are not created speculatively.
- A future Proposal that wants any of these must justify it on real
  Radar responsibility, not on "future reuse".
- If an Agent Runtime is later required, the project will adopt an
  *external* runtime by Proposal, not build its own.

---

## ADR-005 — Tooling set is intentionally minimal at Bootstrap (Node 22 baseline)

**Date:** Bootstrap
**Status:** Accepted

**Decision.** The Bootstrap stage ships with: TypeScript (strict,
ES2022+, ESM), Vitest, Zod, and `@types/node`. No formatter, no
linter, no ORM, no DB driver, no agent SDK, no scraping framework, no
UI framework, and no `tsx` / no runnable entrypoint. The development
runtime baseline is Node 22 (`engines.node: ">=22"`,
`@types/node` on the Node 22 major).

**Reasoning.** Every extra tool adds a maintenance surface, a version
coupling, and a behavioral default. Until a real Radar module exists,
those surfaces have nothing to act on. Adding them now would be
speculative tooling. `tsx` in particular is admitted only when a real
Proposal needs a runnable entrypoint; installing it for hypothetical
future use is exactly the kind of speculative infrastructure this ADR
forbids. Designing for Node 20 compatibility is also deferred until a
real Proposal needs it — the current baseline is the runtime the team
actually uses.

**Consequences.**

- New tools are admitted only by Proposal, with a concrete reason.
- This ADR does not forbid a formatter or linter forever; it defers
  the decision until a Proposal needs them.
- This ADR does not forbid `tsx` forever; a future Proposal that
  introduces a runnable entrypoint may add it.
- This ADR does not forbid Node 20 compatibility forever; a future
  Proposal that targets it may widen `engines.node` and pin a matching
  `@types/node` major.

---

## ADR-006 — better-sqlite3 as the Evidence Store substrate

**Date:** 2026-09-03
**Status:** Accepted (P0001)
**Scope:** Evidence layer (P0001) and any later Proposal that needs
the same single-process, file-backed, append-oriented substrate.

**Decision.** The Evidence Store is built on `better-sqlite3` with
the following baseline:

- `journal_mode = WAL` (concurrent readers while a writer is active)
- `foreign_keys = ON` (referential integrity on the
  `evidence_sources` join)
- `busy_timeout = 5000` (wait up to 5s for a contended lock)
- No ORM. No migration framework. No connection pool. The
  repository takes an open `SqliteDatabase` handle per call.

**Reasoning.** The Evidence layer is single-process, file-backed,
and append-oriented. A relational store with strict schema and
foreign keys matches the model directly. `better-sqlite3` is
synchronous, native, and small — it gives the implementation agent
deterministic control over transactions, which P0001 §Repository
Contract requires (atomic ingest, conservative dedup, append-only
history). The cost of admitting it is one new runtime dep and one
native build step on first install.

The alternatives (Postgres, a vector DB, an embedded JSON store)
either introduce infrastructure the product does not yet need or
hide the atomicity guarantees P0001 depends on. Per ADR-004, none
of those abstractions are admitted until a Proposal proves the
abstraction is real and stable.

**Consequences.**

- WAL mode means the DB file lives next to `-wal` and `-shm`
  sidecars. `.gitignore` ignores all `data/*.db*`.
- The Evidence layer assumes single-writer. Multi-writer concurrency
  is out of scope until a Proposal that needs it shows up.
- Any future Proposal that needs a different substrate (analytics,
  full-text search, vector search) does NOT replace this ADR; it
  adds its own substrate by its own ADR.
- Repository code never owns the connection. All exported
  functions take a `SqliteDatabase`. There is no global connection.

---

## ADR-007 — Evidence ↔ SourceDocument is many-to-many

**Date:** 2026-09-03
**Status:** Accepted (P0001)
**Scope:** Evidence layer (P0001) and any later layer that consumes
Evidence provenance.

**Decision.** An Evidence record is supported by N SourceDocuments,
and a SourceDocument can underwrite M Evidence records. The
relationship is modeled as a join table `evidence_sources` with
`(evidence_id, source_id)` as a composite primary key and
`ON DELETE CASCADE` on both foreign keys.

**Reasoning.** The single most important fact about Evidence in
Opportunity Radar is that *one fact can come from multiple sources*.
The inverse — one source underwriting multiple facts — is equally
true: a single Reuters article may state a funding amount, a
valuation, and a customer count, each a separate Evidence. A
one-to-one model would force a duplication choice (which source
"owns" the fact) that the product must not make.

The corroboration rule is the only consumer of this design:
when a new source supports an existing Evidence, the repository
inserts only the `evidence_sources` link. The Evidence row is
NOT overwritten. The source row is NOT overwritten. The
provenance set grows monotonically.

**Consequences.**

- `evidence_sources` is not optional. Any future migration that
  collapses it to a single foreign key is a regression of this ADR.
- `ON DELETE CASCADE` is a deliberate choice: deleting a Source
  or an Evidence removes its links. Deleting an individual link
  is not currently supported; it must be requested by a future
  Proposal that explains the use case (e.g. retraction).
- Corroboration is detected at the *fingerprint* level, not at
  the *id* level. Two payloads that produce the same fingerprint
  dedup to the same Evidence row. Different fingerprints
  (including contradicting claims) become separate Evidence rows.
- The `getById` and `list` repository calls always return the
  full provenance set. A future caller that wants a single
  "primary" source must request that as a future Proposal; the
  repository never invents one.

---

## ADR-008 — Evidence fingerprint is sha256 of (subject, claim, eventAt, market)

**Date:** 2026-09-03
**Status:** Accepted (P0001)
**Scope:** Evidence dedup.

**Decision.** The Evidence fingerprint is
`sha256(normalize(subject) + "␟" + normalize(claim) + "␟" + eventAtIso + "␟" + market)`
where:

- `normalize(s)` collapses runs of whitespace and trims
- `eventAtIso` is the raw ISO 8601 string, or empty string if
  `eventAt` is `null`
- `market` is the raw enum value
- The separator `"␟"` (U+241F) is chosen to be unlikely to appear
  in any real claim or subject

The fingerprint is an *internal* dedup key. It is never the
business identity of an Evidence.

**Reasoning.** Two Evidence records that describe the same fact
(subject + claim + eventAt + market) are the same Evidence. That
is a stable, mechanical property the database can enforce. The
fingerprint gives us a UNIQUE constraint on a string column, which
is a property every relational store supports and which the
better-sqlite3 substrate can index.

The "normalize" step is intentionally minimal. The fingerprint is
a dedup key, not a claim-equivalence engine. Future work on
semantic dedup (paraphrase detection, entity normalization) is
explicitly out of scope here — that is future-Proposal work, and
it would be a *different* key living alongside this one, not a
replacement.

**Consequences.**

- `crypto.createHash('sha256')` from Node built-ins only. No new
  hashing dep.
- Two Evidence fixtures in the Ground Truth that have the same
  (subject, claim, eventAt, market) tuple MUST carry the same
  fingerprint or the corpus integrity test will fail.
- The `claim` text is part of the fingerprint. Two rephrasings of
  the same fact will get *different* fingerprints and live as
  separate Evidence. The product treats them as separate
  observations until a future Proposal that handles paraphrase
  dedup is approved.
- `subject` is currently a free string. If a future Proposal
  promotes `subject` to a structured entity, this ADR will be
  superseded — that promotion is not a small change to a column,
  it changes the dedup semantics.

---

## ADR-009 — re-introducing `tsx` for `scripts/cli.ts`

**Date:** 2026-09-03
**Status:** Accepted (P0001)
**Scope:** `scripts/db-init.ts`, `scripts/cli.ts`, and any future
runnable entrypoint added by Proposal.

**Decision.** `tsx` is added as a devDependency. The `npm run`
scripts `db:init` and `cli` invoke it. `tsx` is NOT used for tests
(Vitest handles that already). `tsx` is NOT used by the
`evidence/` or `storage/` modules directly — it is purely the
runner for the scripts/ directory.

**Reasoning.** P0001 has a concrete need for a runnable entrypoint
(`scripts/cli.ts` with `evidence:add | evidence:get | evidence:list`).
With `moduleResolution: "Bundler"` and `noEmit: true` in
`tsconfig.json`, the project cannot be executed directly by
`node` against the TypeScript source. ADR-005 explicitly opened
the door for `tsx` once a real Proposal needed a runnable
entrypoint; P0001 is that Proposal.

`tsx` is admitted narrowly: it lives only in `scripts/`, it is
not used to mask missing build configuration, and it does not
cascade into the test or library paths. This keeps ADR-004 and
ADR-005 in force: speculative tooling is still rejected; only
tools with a real Proposal-level justification are admitted.

**Consequences.**

- `tsx` is a devDependency only. It is not in `dependencies`.
- A future Proposal that needs a *second* runnable entrypoint may
  extend this ADR's scope to that entrypoint without writing a
  new ADR. A future Proposal that wants `tsx` for a non-script
  purpose (e.g. test bootstrap, library re-export) must write a
  new ADR explaining the need.
- `tsx` is one of several reasonable choices (e.g. `ts-node`,
  `swc`, a future native Node TS runner). The choice is
  revisable; what is not revisable is the rule that the tool
  must be admitted by ADR.
