# Ground Truth Corpus

Closed, hand-curated fixture set used by the **Evidence** layer of
Opportunity Radar. The corpus is the only "real-world" data the
product has at the end of P0001; every evidence and source-document
implementation is expected to validate against it before any later
Proposal adds more.

## What lives here

| File | Contents | Count |
|---|---|---|
| [sources.ts](sources.ts) | `SourceDocument` fixtures | **20** |
| [evidence.ts](evidence.ts) | `Evidence` fixtures referencing the sources | **36** |
| [index.ts](index.ts) | barrel — re-exports the two arrays | — |

The contracts these fixtures are typed against live in
[../contracts/](../contracts/). A new Property on a contract that
the corpus does not exercise will be caught at typecheck time.

## Why this corpus exists

P0001 requires the system to be **physically observable** before
any Signal / Shift / Thesis / Opportunity is built. A small,
diverse, *atomic* corpus forces every contract decision to be
tested against real-world input — funding rounds, regulatory
filings, product launches, dataset usage, customer counts, and
acquisitions — instead of against synthetic stand-ins.

## Selection

Cases are drawn from the P0001 / Design Notes inventory:

- Wonderful — Series C, valuation, customer base
- XPeng Robotics — financing round, valuation, enterprise pilots
- Prime Intellect — Series A, valuation, technology
- Zhipu AI — ARR, growth, APAC plans
- Google Gemini Enterprise — product launch, pricing, verticals
- Okta / Permiso — acquisition terms
- RoboMIND — dataset downloads, episode count
- PaXini — tactile-sensing data factory
- IFR / Reuters — China & global industrial robot statistics
- State Council, MOFCOM — CN policy

Markets: **US**, **CN**, **GLOBAL**. Languages: **en**, **zh**.
Source types exercised: news, company_announcement, government,
research, repository, product_page.

## Coverage gates (enforced by [tests/contract/ground-truth-corpus.test.ts](../../../tests/contract/ground-truth-corpus.test.ts))

The corpus is not a marketing artifact — it is a contract. The
integrity test asserts:

| Gate | Target | Why |
|---|---|---|
| Source count | 15 ≤ n ≤ 25 | P0001 §Ground Truth size |
| Evidence count | 30 ≤ n ≤ 50 | P0001 §Ground Truth size |
| Source ID uniqueness | all distinct | dedup correctness |
| Evidence ID uniqueness | all distinct | dedup correctness |
| Every evidenceType in the taxonomy | ≥ 1 evidence each | taxonomy is exercised end-to-end |
| Atomicity | ≥ 5 sources split into ≥ 3 evidence each | source-1:N-evidence shape is real |
| Corroboration | ≥ 2 evidence with ≥ 2 sourceRefs | Evidence ↔ Source many-to-many is real |
| `sourceRefs[i]` resolution | every ref exists in `groundTruthSources` | no dangling references |

If a future Proposal grows the corpus, it must keep all gates
green or relax them by ADR (not by editing the test to pass).

## Atomicity examples

One source supports multiple evidence:

- `src-reuters-wonderful` → 5 evidence (Series C, valuation,
  customers, customer-doubling, Sequoia lead)
- `src-xpeng-announcement` → 4 evidence (raise, valuation,
  pilots, Alibaba lead)
- `src-google-gemini-blog` → 5 evidence (launch, data isolation,
  pricing, verticals, industry agents)
- `src-reuters-prime-intellect` → 4 evidence (Series A,
  valuation, round size, distributed training)
- `src-reuters-zhipu` → 4 evidence (growth, ARR, enterprise
  concentration, 2026 H1 raise)

Five sources pass the ≥ 3 threshold; the rest sit at 1–2.

## Corroboration examples

Evidence supported by ≥ 2 sourceRefs:

- `ev-wonderful-series-c` — Reuters + TechCrunch
- `ev-wonderful-customers` — Reuters + Caixin
- `ev-xpeng-raise` — XPeng announcement + Reuters
- `ev-xpeng-valuation` — XPeng announcement + Reuters
- `ev-prime-intellect-valuation` — Reuters + Bloomberg
- `ev-zhipu-growth` — Reuters + SCMP
- `ev-gemini-launch` — Google blog + TechCrunch
- `ev-okta-acquires-permiso` — Reuters + Okta press release
- `ev-robomind-downloads` — RoboMIND + Hugging Face
- `ev-china-robots-growth` — IFR + Reuters

Ten evidence pass the ≥ 2 threshold. None of them is silently
rewritten by the second source — both are preserved as
provenance.

## IDs

- Source IDs are stable: `src-<publisher>-<slug>`.
- Evidence IDs are stable: `ev-<subject>-<claim-slug>`.
- At runtime, IDs are generated with `crypto.randomUUID()`.
  Deterministic IDs in the corpus are for **test stability**,
  not for business identity.

## `metadata`

`metadata` is used **sparingly**. Recurring shapes (currency +
amount, period + growthRate) are candidates for first-class
fields. The Design Review in the P0001 Completion Report will
list the recommendations; promotion itself is a future Proposal.
