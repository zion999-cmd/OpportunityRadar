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
