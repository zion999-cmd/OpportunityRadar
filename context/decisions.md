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

---

## ADR-010 — Persistent Hermes session lifecycle (one session per Radar workspace)

**Date:** 2026-09-03
**Status:** **Stale — Superseded by ADR-015 (2026-09-03).** The
"persistent Hermes session" constraint asserted a Radar-owned
Agent-session lifecycle. The reworked P0002 (proposal re-author)
removes that constraint entirely: Radar MUST NOT own Agent
Runtime session lifecycle. No Radar code refers to this ADR's
persistent-session design. Kept here as a historical record. See
ADR-015.
**Scope:** P0002 §14 and any future Proposal that talks to Hermes.

**Decision.** Radar holds **one long-lived Hermes session** for its
lifetime. Every Exploration Goal is sent as a turn to the **same
named session** (`opportunity-radar` by default). The session is
created / resumed once at Radar startup and reused for every Goal
until Radar (or the Hermes gateway) shuts down.

**Why.** Replaying or re-spawning per Goal is the pattern the user
explicitly rejected (§14.1). It also defeats the point of session
continuity: the agent has to re-derive context, the gateway has to
re-load tools, and the cost / latency shape becomes per-Goal instead
of per-session.

The Hermes `hermes serve` gateway exposes the surface this design
needs: `POST /api/sessions/{session_id}/chat` is a server-side
persistent-session endpoint (verified in source at `gateway/
platforms/api_server.py`). Radar opens a client connection to the
gateway, sends each turn to the same session id, and lets the
gateway own the context.

**Consequences.**

- The bridge (`exploration/bridge/exploration-bridge.ts`) takes a
  `HermesClient` that has a fixed `sessionId` set at construction.
  Every `sendTurn` reuses it.
- Session reconnect/resume is **recovery behavior**, not normal
  per-Goal execution. If the gateway drops, the bridge reconnects
  with the same `sessionId` and restores only the minimum
  execution context (the system-prompt contract). Full history
  replay is explicitly forbidden.
- Radar business state (Evidence, run records) lives in Radar
  SQLite, **not** in the Hermes session. The session is execution
  context only.
- If the Hermes interface ever stops supporting a persistent
  multi-Goal session, **STOP and report** before implementing a
  per-Goal fallback. The user explicitly bound this with §14.2.
- A future Proposal may add an *Observation* capability (fixed
  source monitoring). It will need its own session-lifecycle
  decision; this ADR does not constrain that.

---

## ADR-011 — Bridge uses prompt-only JSON, one bounded repair retry, no regex fallback

**Date:** 2026-09-03
**Status:** **Stale — Superseded by ADR-015 (2026-09-03).** The
"one bounded repair retry" loop was tied to the bridge owning a
prompt to the Agent. The reworked P0002 removes that loop: the
bridge only ingests a Zod-typed `ExplorationResult`. Whoever
drives the external Agent is responsible for "make the Agent
produce valid JSON." Kept here as a historical record. See
ADR-015.
**Scope:** Exploration bridge — Hermes → Radar contract boundary.

**Decision.** The exploration bridge takes the agent's response
text through this exact pipeline:

```
Hermes response text
  → JSON.parse (strict)
  → Zod validate (explorationResultSchema)
```

**Why.** Regex-based JSON extraction is fragile: a regex that
"works" today can break tomorrow when Hermes reformats a single
quote. The user explicitly forbade regex fallback in §13.2.

The first response is parsed strictly. On JSON syntax failure, the
bridge sends **one** bounded repair prompt asking Hermes to emit
valid JSON only. On Zod (schema) failure, the bridge does **not**
repair — a schema failure is a content problem, not a syntax
problem, and a second prompt would just re-emit the same content
most of the time. If either the initial parse or the repair parse
fails, the run is recorded as `failed` and no evidence is
ingested.

**Consequences.**

- The CandidateSource URL is a string at the agent-output boundary
  (`z.string()`, not `z.string().url()`). The bridge enforces
  "non-empty URL" as the provenance gate. P0001's
  `SourceDocument.canonicalUrl: z.string().url()` is the second
  gate; a candidate with `url: 'not a url'` is rejected by
  IngestPayload's Zod parse and counted as rejected.
- The bridge counts candidates that fail either gate as
  `rejected`, never as a `failed` run. A run is `failed` only when
  the bridge could not produce a parsed `ExplorationResult` at all.
- This ADR does **not** require the bridge to coerce prose to
  JSON. A response that does not parse is recorded as failed; the
  prompt is the agent's responsibility.
- A future Proposal that wants more robust structured output (e.g.
  tool-calling instead of prompt-based) is a contract change and
  must arrive by Proposal.

---

## ADR-012 — Capability probe is the precondition for live acceptance

**Date:** 2026-09-03
**Status:** **Stale — Superseded by ADR-015 (2026-09-03).** The
"capability probe" was a Radar-owned precondition for live
acceptance (scripts/probe-persistent-session.ts). The reworked
P0002 removes the probe entirely: there is no Radar-side runtime
to probe. Live acceptance is a deployment concern decided outside
Radar. Kept here as a historical record. See ADR-015.
**Scope:** Any future Proposal whose success criteria include
"live run against the open web" via an external agent.

**Decision.** Before a live acceptance run, the implementation must
verify end-to-end that the agent can actually do the work — search
the live web, fetch a URL it did not previously know, and return
structured output. If the probe fails, the run is **reportable as
a blocker**, not a trigger to build a crawler, scraper, or any
other acquisition subsystem to satisfy the acceptance criterion.

**Why.** The capability is non-negotiable. P0002 §13.1 made this
explicit. Building a parallel acquisition path just to satisfy
the run introduces a duplicate code path that is exactly the
"exploration = known source + scraping framework" pattern the
Proposal said to avoid.

The P0002 implementation carries out two probes:

1. **Web capability** — `hermes chat -q` against the real Hermes
   CLI. Confirms Hermes can search the open web and fetch a URL
   it found. This was run successfully in 2026-09-03 with 6+
   `search` calls, 2 `browser.open` calls, and 1 session of 8
   turns / 1m 48s.
2. **Persistent-session capability** — the gateway's
   `POST /api/sessions/{id}/chat` endpoint, verified at the
   source-code level (the gateway is the long-lived process; the
   session is server-held; the user explicitly opted to defer
   end-to-end runtime verification of this to the first action of
   live acceptance).

**Consequences.**

- P0002 ships with the persistent-session end-to-end probe
  **deferred to live acceptance**. If the runtime probe fails at
  that point, §14.2 applies: STOP and report, no per-Goal
  subprocess fallback.
- A future Proposal that adds a new external capability (e.g. a
  third-party API) inherits this rule: probe first, then plan
  against proven capability, not against assumed capability.
- A future Proposal that wants to make this a fully automated
  pre-merge check must arrive with its own ADR; that is
  appropriately CI-level work, not P0002 scope.

---

## ADR-013 — AgentExecutor boundary — Agent runtimes are replaceable executors, not Radar domain concepts

**Date:** 2026-09-03
**Status:** **Superseded by ADR-015 (2026-09-03); reinforced by ADR-016 (2026-09-03).** The `AgentExecutor` interface described here was a softer version of the boundary; the reworked P0002 (proposal re-author, Agent-neutral) removes the `AgentExecutor` surface entirely. Radar no longer holds an adapter-shaped concept for an Agent Runtime inside the Domain. ADR-016 records the new replaceable seam (`RuntimeAdapter`) and its location (`runtime/types.ts` + concrete adapters under `runtime/<name>/`). See ADR-015 for the Domain rule, ADR-016 for the seam rule.
**Scope:** Every Proposal that talks to an external agent runtime
(Hermes today; potentially Codex, Claude, or a future runtime
later). Bound for the lifetime of the product.

**Decision.** The Exploration layer talks to agent runtimes
through a single narrow interface:

```ts
interface AgentExecutor {
  sendTurn(opts: { prompt: string }): Promise<{ text: string }>;
}
```

That is the entire contract. There is no `isReady()`, no
`health()`, no `probe()`, no `capabilities()`, no `configure()`,
no `dispose()`, and no model-turn readiness check on the
interface. If an executor wants a transport-level health check
(e.g. an HTTP status endpoint), that lives **inside** the
executor adapter and is never visible to the bridge, the
contracts, the repository, or the Evidence Foundation.

**Why.** Before this ADR, Hermes-specific concerns leaked into
the CLI (`HERMES_GATEWAY_URL`, `HERMES_GATEWAY_TOKEN`,
`OPPORTUNITY_RADAR_HERMES_SESSION`, port `9120`, the
`/api/sessions/{id}/chat` shape) and the bridge (`hermes:
HermesClient` was a named field in the public config). Hermes
was a concrete adapter the rest of the codebase had to know
about by name. That is exactly the "agent framework" leak ADR-004
and ADR-010 both reject.

Sending a model turn as a readiness probe would have been
worse: it would have wasted tokens and polluted the persistent
session (ADR-010), which is the whole reason Radar holds a
persistent Hermes session in the first place. So the interface
also has no model-turn probe of any kind. If the runtime is
unreachable, `sendTurn` throws and the bridge records the run
as `failed`. That is the only failure surface the Exploration
layer relies on.

Radar must also never require an upstream model API key in its
own code. The executor is expected to be already installed,
configured, and authenticated in its own runtime environment.
The adapter reads whatever env vars its runtime documents and
throws a typed error (`MissingHermesCredentialError` in the
Hermes case) if the runtime cannot be reached. The CLI (the
composition root) catches that error and exits with a clear
message. Radar itself stays free of provider credentials.

**Hard boundary.** The following modules MUST NOT import from
`exploration/hermes/`:

- `exploration/contracts/`
- `exploration/bridge/`
- `exploration/repository/`
- `evidence/` (P0001 Evidence Foundation)
- `storage/`
- `shared/`

A grep for `hermes` in any of those directories is a CI failure
once CI exists. A future Proposal that wants to add Codex (or
any other executor) does so by writing a new executor adapter
(e.g. `exploration/codex/codex-executor.ts`) and rewiring the
composition root — `scripts/cli.ts` — to call
`createCodexExecutor()` instead of `createHermesExecutor()`. The
bridge, the contracts, the repository, the Evidence Foundation,
and the P0001 substrate do not change.

**Consequences.**

- `exploration/agent/agent-executor.ts` is the only file that
  defines the contract. It is one interface with one method.
- `exploration/hermes/hermes-client.ts` remains as the
  low-level Hermes HTTP client (persistent session, transport
  parsing, AbortSignal timeouts). Its internal `isReady()` is a
  transport-level `GET /api/status` probe — it stays on this
  type because it is not a model turn, but it is not exposed
  on the `AgentExecutor` surface.
- `exploration/hermes/hermes-executor.ts` is the Hermes
  adapter that owns all Hermes-specific configuration: the
  three Hermes env vars, the persistent-session id, and
  Hermes-specific runtime parameters (maxTurns,
  runBudgetSeconds). It is the only file in the repo that
  constructs a `HermesClient`.
- `scripts/cli.ts` is the composition root. It is the only
  file that may explicitly call `createHermesExecutor()`.
  Knowing which concrete executor is currently selected is
  acceptable at the composition root; it is **not** acceptable
  in the bridge, the contracts, the repository, or the
  Evidence Foundation.
- A future Proposal that adds Codex or Claude does not need
  to touch the bridge. It needs a new executor adapter and a
  one-line wiring change in the CLI.
- A future Proposal that wants a generic "executor registry"
  or "provider selection" abstraction must arrive with its
  own ADR and is explicitly NOT a small change. The current
  design has exactly one wired-in executor; that is
  intentional.
- The CLI's help text no longer enumerates the Hermes env
  vars. The list lives in `hermes-executor.ts`'s doc comment
  and the ADR; users reading the CLI help get pointed at
  those sources instead of seeing Hermes-specific config
  leak into Radar's outermost UI.

---

## ADR-014 — Amendment to ADR-013: Hermes transport is the `/api/ws` WebSocket; Executor credential-consumption boundary

**Date:** 2026-09-03
**Status:** **Superseded by ADR-015 (2026-09-03); reinforced by ADR-016 (2026-09-03).** The Hermes WebSocket surface and the `AgentExecutor` adapter it was plugged into no longer exist in the Radar source tree. The "credential-consumption" framing (consume, but don't discover) was a softer version of the boundary; ADR-015 is strictly stronger — Radar has no Agent credential concern at all. ADR-016 further locates the seam: a concrete Hermes adapter may exist under `runtime/hermes/`, but it takes no credentials (it shells out to the `hermes` CLI on `PATH` and trusts the operator). See ADR-015 and ADR-016.
**Scope:** Amends ADR-013's transport-specific details. Does **not**
amend ADR-013's narrowing core (the `AgentExecutor` interface, the
hard boundary, "no model-turn readiness probe"). When this ADR and
ADR-013 disagree about transport, this ADR wins.

**Decision 1 — Transport change.** The Hermes transport
described in ADR-013 is replaced.

- ADR-013 described a `POST /api/sessions/{id}/chat` HTTP gateway
  on port `9120` with a `HERMES_GATEWAY_TOKEN` bearer. That
  transport is **not** the one Radar uses. The chosen transport is
  Hermes' own persistent-session **WebSocket** surface, mounted on
  `hermes_cli/web_server.py` at `/api/ws`, defaulting to
  `ws://127.0.0.1:9119/api/ws`. The wire protocol is the TUI
  protocol (newline-delimited JSON-RPC, verified in
  `tui_gateway/ws.py:7-13` and `tui_gateway/server.py:2018 _emit`).
- Radar uses `session.create` **once** (lazily on the first turn
  of a fresh client) and `prompt.submit` for **every** subsequent
  turn on the same `session_id`. Streaming response is collected
  from `message.delta` events; the turn resolves on `message.complete`
  and rejects on `message.error` / `turn.error` / wall-clock budget
  exhaustion.
- Radar no longer reads `HERMES_GATEWAY_URL`, `HERMES_GATEWAY_TOKEN`,
  or any of the gateway-tier env vars. They belong to a different
  service. The Hermes env vars Radar actually reads are:
  - `HERMES_WS_URL` — optional, defaults to
    `ws://127.0.0.1:9119/api/ws`.
  - `HERMES_DASHBOARD_SESSION_TOKEN` — **required**; this is
    Hermes' own `_SESSION_TOKEN` from
    `hermes_cli/web_server.py:540`, passed as `?token=` on the
    WebSocket URL. `web_server._ws_auth_reason` validates the
    token in both `auth_required: true` and loopback modes, so
    the token is mandatory regardless of bind address.
- `hermes-client.ts` no longer has a transport-level `isReady()` /
  `GET /api/status` probe. The previous "transport-level probe,
  not model turn" carve-out is gone: there is no separate readiness
  channel. If the WebSocket is unreachable, `sendTurn` throws and
  the bridge records the run as `failed`. That is the only
  failure surface.

**Decision 2 — Credential-consumption boundary (the new line
in ADR-013).** The following sentence is now part of ADR-013's
binding text:

> "Executor adapters may consume externally supplied transport
>  credentials, but MUST NOT discover, manage, persist, or
>  provision executor-runtime credentials."

In concrete terms for `hermes-executor.ts`:

- MAY consume `HERMES_DASHBOARD_SESSION_TOKEN` from the Radar
  process environment (the operator put it there).
- MAY consume `HERMES_WS_URL` from the Radar process environment,
  falling back to the documented loopback default
  `ws://127.0.0.1:9119/api/ws`.
- MUST NOT scan process environments, read `~/.hermes/.env`, or
  invoke `lsof` / `ps eww` / `/proc` to discover the token.
  (AgentFabric's auto-discovery pattern is explicitly **rejected**;
  Radar does not inspect another process's environment to find
  credentials.)
- MUST NOT generate, persist, rotate, or provision the token.
- MUST NOT manage Hermes authentication in any form. If
  `HERMES_DASHBOARD_SESSION_TOKEN` is missing or empty,
  `createHermesExecutor` raises `MissingHermesCredentialError`
  and the CLI (the composition root) exits with a clear message.

**Why this is the rule.** Credential *consumption* is transport
integration. Credential *discovery / management* is runtime
ownership. Radar owns neither Hermes auth nor Hermes runtime
configuration — Hermes is expected to already be running, already
configured, and already authenticated by its operator. A
reusable design rule is the only thing that keeps this honest as
new executor adapters are added later (a future Codex / Claude /
external-runtime adapter inherits the same boundary, not its own
variant).

**Consequences.**

- `scripts/cli.ts` (the composition root) is the only file that
  may mention `HERMES_DASHBOARD_SESSION_TOKEN` to the user. The
  adapter raises `MissingHermesCredentialError`; the CLI catches
  it and exits 2 with a clear message. No token auto-discovery
  branch exists in `hermes-executor.ts` by design.
- Node 22's built-in global `WebSocket` (WHATWG) is the
  production WebSocket. No new dependency was added; Node 22 is
  the runtime baseline per ADR-005. If a future Proposal needs to
  drop below Node 22, this assumption must be re-verified
  (downgrade or new ADR).
- A future Proposal that adds a new executor adapter
  (Codex / Claude / external runtime) inherits this boundary
  verbatim. The boundary is on the **adapter role**, not on
  Hermes.
- The persistent-session lifecycle is unchanged from ADR-010
  (one long-lived session per Radar workspace, the session is
  execution context only, full history replay is forbidden). The
  transport change does not relax that rule.

---
## ADR-015 — Radar domain is Agent-neutral (P0002 architectural rework)

**Date:** 2026-09-03
**Status:** Accepted (P0002 Rework #1); reinforced by ADR-016 (P0002 Rework #2)
**Scope:** Binding for the product lifetime. Supersedes ADR-013
and ADR-014; supersedes the persistent-session and repair-retry
framing of ADR-010 and ADR-011; supersedes the capability-probe
framing of ADR-012. Every Proposal that touches the Exploration
layer, every Radar-owned module, and every test under
`tests/` inherits this rule. ADR-016 reinforces this ADR by
recording the *location* and *shape* of the replaceable runtime
seam: `runtime/types.ts` is the Agent-neutral seam; concrete
adapters live under `runtime/<name>/`.

**Decision.**

1. **No Agent Runtime by name in Radar.** Radar-owned modules
   (`evidence/`, `exploration/`, `storage/`, `shared/`,
   `scripts/`, and the tests under `tests/`) MUST NOT import,
   name, depend on, or test against a specific Agent Runtime —
   no Hermes, no Codex, no Claude, no OpenClaw. They MUST NOT
   expose the old `AgentExecutor` / `AgentSendOptions` /
   `AgentSendResult` / `sendTurn` surface, either.
2. **No Agent credential, transport, session, model, or tool
   ownership in Radar.** Radar-owned modules have no Agent
   credential concern (no env-var reads, no discovery, no
   `~/.hermes/.env`, no `lsof` / `ps eww` / `/proc`), no Agent
   transport concern (no `/api/ws`, no `9119`, no `9120`), no
   Agent session concern (no session ids, no reconnect, no
   per-Goal session affinity), no Agent model concern, no Agent
   tool concern. The external Agent integration seam is a
   deployment concern decided outside the Radar source tree.
3. **The boundary is a typed seam, not a protocol on disk.**
   The Radar ↔ external Agent boundary is the
   `RuntimeAdapter.execute(goal): Promise<ExplorationResult>`
   method on the Agent-neutral runtime seam
   (`runtime/types.ts`). The bridge sees only typed objects
   after Zod validation. There is no further abstraction (no
   "Big Agent Connector Protocol", no Agent Registry, no
   Agent Discovery, no Capability negotiation, no Streaming
   surface in Radar, no Tool Event surface in Radar). The
   boundary is **not** a file pair on disk (that was the
   Rework #1 framing and is no longer the design — the
   bridge is actively dispatching, not passively ingesting).
4. **The boundary is enforced by an architecture test.**
   `tests/architecture/agent-boundary.test.ts` scans every
   `.ts` file in `evidence/`, `exploration/`, `storage/`,
   `shared/`, `runtime/` for the forbidden token set
   (specific Agent Runtime names; the old AgentExecutor
   surface; the Hermes transport surface; the Hermes env
   vars) and FAILS the test suite on any match. The
   allowlist is `runtime/hermes/`, `scripts/cli.ts`,
   `runtime/index.ts`, and the test itself. A failure of
   that test is an architectural violation, not a test bug.

**Why.** The previous P0002 design (ADR-013, ADR-014) integrated
Agent Runtime internals (Hermes transport, persistent session,
`/api/ws` WebSocket, `HERMES_DASHBOARD_SESSION_TOKEN`,
`AgentExecutor` adapter) into the Radar domain. The user
identified this as an **architectural ownership error**, not a
protocol-thickness problem. The root cause is:

> Radar owns business semantics; Agent owns execution mechanics.

The previous framing — "executor adapters may consume transport
credentials but must not discover them" — was a softer version
of the same boundary. ADR-015 is strictly stronger: Radar has
no Agent credential concern at all.

The previous framing also collapsed into a "Big Agent Connector
Protocol" temptation: name a neutral interface, plug in
Hermes/Codex/Claude, ship an Agent registry. The user's
direction is the opposite. Radar's business object is the
`(Goal, Result)` data shape. Whatever drives the external
Agent, and whatever transport / session / credential / model
/ tool that external Agent uses, is hidden behind the
`RuntimeAdapter` seam. ADR-016 makes the seam shape and
location explicit.

**Consequences.**

- The Exploration bridge (`exploration/bridge/exploration-bridge.ts`)
  has the surface `bridge.run(goal)`. It does not have a
  constructor parameter named `executor`, no
  `systemPromptTemplate`, no `repairPromptTemplate`, no
  `JSON.parse + repair retry` loop, no `sendTurn` call. It
  dispatches the Goal through the Agent-neutral router, Zod-
  revalidates the Result, and ingests the accepted candidates
  through P0001.
- Whoever wires an Agent capability to Radar does so through
  `runtime/<name>/` (a concrete adapter) plus a one-line
  composition-root change in `scripts/cli.ts`. The Radar
  Domain stays unchanged when the Agent Runtime is upgraded,
  replaced, or removed.
- The previous P0002 NOT-Included list (any Agent Framework,
  any Agent Registry / Discovery / Capability / Session
  Protocol, any Streaming surface, any Tool Event surface, any
  Agent lifecycle / credential / config manager, any specific
  Agent Runtime adapter, AgentFabric / CBP / MCP / plugin
  platforms) becomes **architectural prohibition**, not just
  out-of-scope.
- ADR-004 ("No platform, no runtime, no shared infrastructure
  in Bootstrap") is reinforced. ADR-001 ("Opportunity Radar
  is independent from AgentFabric") is reinforced. ADR-005
  ("Tooling set is intentionally minimal at Bootstrap") is
  reinforced.
- The CLI subcommand `explore --market <M> --question "..."`
  is the operator surface. It is the only Radar file that
  names a Radar-side Goal / Result lifecycle concern, and it
  is itself an operator concern, not a Radar domain concern.
- A future Proposal that wants to add a *new concrete
  adapter* (Codex, Claude, OpenClaw, anything) adds a new
  `runtime/<name>/` directory and a one-line wiring change
  in `scripts/cli.ts`. No new ADR is required.
- A future Proposal that wants to add a *new capability to
  the runtime seam* (streaming, capability negotiation,
  model metadata, session lifecycle, token accounting) MUST
  arrive with its own ADR; ADR-016 keeps the seam thin.

**How to apply.** When reviewing any future change to the
Exploration layer (or any layer that needs an external
capability), check the four rules above. If a change would
require importing a specific Agent Runtime by name, requiring
a transport / session / credential for an external Agent, or
adding a Streaming / Tool Event / Session / Registry surface
in Radar, stop and report; the change is an architectural
violation, not a scope creep, and needs a new ADR that
re-opens ADR-015.

---

## ADR-016 — Runtime seam is replaceable and Agent-neutral — `RuntimeAdapter` is the boundary (P0002 Rework #2)

**Date:** 2026-09-03
**Status:** Accepted (P0002 Rework #2)
**Scope:** Binding for the product lifetime. Reinforces
ADR-015 (Domain neutrality) by recording the *location* and
*shape* of the replaceable runtime seam. Every Proposal that
touches the runtime seam, every concrete adapter under
`runtime/<name>/`, and every composition-root change in
`scripts/cli.ts` inherits this rule.

**Decision.**

1. **The runtime seam is two interfaces and one default
   router in `runtime/types.ts`.** Specifically:
   - `RuntimeAdapter` — `readonly runtimeId: string` and
     `execute(goal: ExplorationGoal): Promise<ExplorationResult>`.
     Adapters MAY throw if the Runtime is unavailable; the
     bridge translates that into a `failed` run record with
     the error message preserved.
   - `ExplorationRuntimeRouter` —
     `dispatch(goal: ExplorationGoal, routerPreference?: string): Promise<ExplorationResult>`.
     The single Control-Plane entry point the Domain depends on.
   - `DefaultExplorationRuntimeRouter(adapter)` — holds a
     single adapter; dispatches 1:1. The `routerPreference`
     argument is accepted but ignored (kept on the signature
     so call sites do not change when a second adapter lands).
2. **The seam is intentionally thin.** "Goal in, Result out"
   is the entire contract. Adding any of the following
   capabilities to the seam requires a new ADR:
   - Capability negotiation, capability metadata, capability
     registry, capability listing.
   - Model metadata, model registry, model selection.
   - Session lifecycle (create / resume / close / reconnect),
     per-Goal session affinity, session id on the boundary.
   - Streaming (`message.delta`, `message.complete`, etc.).
   - ToolEvent / TurnEvent / progress channel.
   - Token accounting, cost accounting, rate limiting.
   - Multi-Runtime routing, failover, load balancing.
   - Runtime health probes, capability probes.
3. **Concrete adapters live in their own directory.**
   `runtime/hermes/` is the only adapter shipped today.
   Future adapters live under `runtime/<name>/` (e.g.
   `runtime/codex/`, `runtime/claude/`, `runtime/openclaw/`,
   `runtime/<x>/`). Each adapter is allowed to depend on its
   Runtime's internals (transport, prompt shape, output
   format, auth, etc.). The architecture test does not scan
   adapter directories; the runtime seam itself is scanned.
4. **The composition root is `scripts/cli.ts`.** It is the
   only file that wires a concrete adapter. Adding a new
   concrete adapter is a one-line wiring change in
   `scripts/cli.ts` plus a new `runtime/<name>/` directory.
   The Domain (`evidence/`, `exploration/`, `storage/`,
   `shared/`) does not change. The runtime seam
   (`runtime/types.ts`) does not change.

**Why.** P0002 went through three iterations. The original
design integrated Hermes into the Domain (an
`AgentExecutor` adapter + `/api/ws` WebSocket + persistent
session + capability probe + JSON-repair retry) — an
architectural ownership error. Rework #1 fixed the Domain
shape (Agent-neutral) but went too far: the active dispatch
path was deleted, and the bridge became a passive repository
for `goal.json` + `result.json` written by an external
operator. That was wrong.

Rework #2 keeps the Agent-neutral Domain and adds active
dispatch back through a thin seam. The seam is borrowed from
AgentFabric (Router → RuntimeAdapter → Concrete Runtime) but
intentionally minimal — a single method. A thicker seam
re-introduces Agent-shape concerns in Radar; a thinner one
removes the replaceability the user wants. This is the
balance.

The seam location is *inside* the source tree, but strictly
under `runtime/`. The Domain is untouched. The composition
root is the only file that knows which concrete adapter is
wired today.

**Consequences.**

- `scripts/cli.ts` constructs a `HermesRuntimeAdapter` (or,
  tomorrow, a different concrete adapter) and injects it
  into `DefaultExplorationRuntimeRouter`. The result is
  passed to `createExplorationBridge({ db, router, … })`.
  The bridge never imports a concrete adapter.
- The CLI subcommand `explore --market <M> --question "..."`
  is the operator surface. The Rework #1
  `exploration:ingest --goal <path> --result <path>`
  subcommand is removed.
- `runtime/hermes/` ships today. It contains:
  `HermesRuntimeAdapter` (`runtimeId='hermes'`),
  `buildHermesPrompt` (Goal → Hermes blind prompt),
  `extractJsonObject` + `parseHermesOutput` (Hermes stdout
  → typed Result with market normalization),
  `HermesSubprocessClient` (one-shot CLI: `hermes -z
  "<prompt>" --safe-mode`),
  `HermesStubClient` (test / no-Hermes fallback), and the
  `HermesClient` interface. The adapter takes no credentials;
  the Hermes CLI is expected to be on `PATH`.
- The V3 schema migration (`ALTER TABLE exploration_runs
  ADD COLUMN runtime_id`) records the adapter's public
  identity (`'hermes'` today) on each `RunRecord`. The
  column is the only Runtime-derived field persisted; no
  session id, no model name, no token count, no transport
  hint.
- A future Proposal that wants to add a *new concrete
  adapter* (Codex, Claude, OpenClaw, anything) does NOT
  need a new ADR. It adds the adapter under
  `runtime/<name>/`, updates the composition root, and
  extends the architecture-test allowlist by a single line.
- A future Proposal that wants to add a *new capability to
  the seam* (any of the items in rule 2 above) MUST arrive
  with its own ADR. That ADR explains the new capability,
  the failure mode that motivates it, and the architectural
  cost. ADR-016 keeps the seam thin by default.
- A future Proposal that wants to add a `RuntimeRegistry`,
  `Capability Registry`, "select the right runtime for this
  goal" routing, or a health probe is a *seam-capability*
  change and is rejected by default. It requires a new ADR
  that re-opens ADR-016.

**How to apply.** When reviewing any future change to the
runtime seam, ask: "is the change a new concrete adapter
under `runtime/<name>/` (no new ADR needed) or a new
capability on the seam itself (new ADR required)?" The
distinction is the line between "wiring" and
"re-architecting". ADR-015 + ADR-016 together keep the
Domain Agent-neutral and the seam thin; together they are
the load-bearing rules for the runtime layer for the
lifetime of the product.

---

