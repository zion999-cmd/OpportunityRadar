# Stage Audit — Semantic Native Recruiting POC 01

> Documentation-only freeze audit. No runtime behavior was modified.
> No models were invoked. No web fetches were performed. This
> document records the factual state of the Semantic Native
> Recruiting POC at the end of the P004 × Patch and P012 × Patch
> reevaluation cycles.

## 0. Status legend

Each claim in this document is tagged with one of:

- **VERIFIED BY POC** — directly observed in the artifacts produced
  by the Semantic Native Recruiting POC during the
  P004 × Patch and P012 × Patch vertical slices.
- **OBSERVED BUT NOT GENERALIZED** — observed in the POC, but only
  on the cases described; not yet demonstrated across the
  universe of possible inputs.
- **INFERENCE** — a conclusion drawn from POC artifacts by the
  auditor; not itself an artifact, and not yet tested.
- **UNTESTED HYPOTHESIS** — a claim that the POC has not yet
  exercised, stated here for traceability only.
- **KNOWN LIMITATION** — a fact about the POC that bounds the
  conclusions that can be drawn from it.

## 1. Required factual milestones

### 1.1 Collision-01

**VERIFIED BY POC.** [research/semantic-native/real-evidence/collision-01/](research/semantic-native/real-evidence/collision-01/) contains:

- 12 real public professional evidence samples admitted from
  [research/semantic-native/real-evidence/pilot-01/](research/semantic-native/real-evidence/pilot-01/) (P001–P012, each with
  URL, source title, source type, retrieval date, and acquisition
  notes — see [research/semantic-native/real-evidence/pilot-01/acquisition-log.ndjson](research/semantic-native/real-evidence/pilot-01/acquisition-log.ndjson)).
- Patch Employer-01 (see [research/semantic-native/real-evidence/employer-01/](research/semantic-native/real-evidence/employer-01/): [sources.md](research/semantic-native/real-evidence/employer-01/sources.md), [raw-employer-expression.md](research/semantic-native/real-evidence/employer-01/raw-employer-expression.md), [evidence-reconstruction.md](research/semantic-native/real-evidence/employer-01/evidence-reconstruction.md)).
- 6 relationships surfaced, recorded in
  [research/semantic-native/real-evidence/collision-01/relationship-discovery.md](research/semantic-native/real-evidence/collision-01/relationship-discovery.md):
  P004, P006, P008, P010, P012 (all initially `worth_exploring`)
  and P003 (initially `uncertain`).

### 1.2 Falsification

**VERIFIED BY POC.** [research/semantic-native/real-evidence/collision-01/relationship-falsification.md](research/semantic-native/real-evidence/collision-01/relationship-falsification.md) records the falsification verdicts:

- **SURVIVES:** P004, P012
- **WEAK:** P006, P010
- **FAILS:** P003, P008

The falsification file also records cross-relationship findings on
abstraction patterns that caused false-positive pressure and on
which evidence was most often missing when distinguishing analogy
from transfer.

### 1.3 P004 × Patch

**VERIFIED BY POC.** The full loop was run through the existing
recruiting-POC investigation runtime
([matching/recruiting-poc/investigation/](matching/recruiting-poc/investigation/)). The
P004 artifacts in [artifacts/recruiting-poc/investigation/](artifacts/recruiting-poc/investigation/) are:

- `2026-09-07T10-37-53-502Z_p004-patch-investigation.json` —
  relationship-specific decisive unknown produced by
  `identifyEvidenceGap`.
- `2026-09-07T11-14-22-104Z_p004-patch-investigation.json` —
  evidence requirement, evidence holder, acquisition route, and
  acquisition action produced by `planAcquisition`. The plan
  rejected the current user as evidence holder and emitted no human
  question.
- `2026-09-07T11-54-03-900Z_p004-patch-investigation.json` —
  reevaluation result after the bounded public acquisition.

The P004 acquisition is recorded in
[research/semantic-native/real-evidence/p004-acquisition-01/](research/semantic-native/real-evidence/p004-acquisition-01/):

- [acquisition-log.md](research/semantic-native/real-evidence/p004-acquisition-01/acquisition-log.md)
- [evidence-result.md](research/semantic-native/real-evidence/p004-acquisition-01/evidence-result.md)

Outcome: **EVIDENCE_NOT_FOUND**. Final relationship outcome:
**`surface_worth_exploring`**. The live reevaluation artifact is
preserved; the full reasoning, evidence used, and remaining
uncertainty are inside it.

### 1.4 P012 × Patch

**VERIFIED BY POC.** P012 was run through the **same** runtime and
the **same** prompt as P004 (no P012-specific heuristics). The P012
artifacts in [artifacts/recruiting-poc/investigation/](artifacts/recruiting-poc/investigation/) are:

- `2026-09-07T11-59-34-815Z_p004-patch-investigation.json` —
  P012's `identifyEvidenceGap` + `planAcquisition` output. The
  file body is the P012 run; the filename uses the existing
  `p004-patch` convention because the artifact writer does not
  encode the `personId` in the filename (see §6 KNOWN LIMITATIONS).
  The `relationshipCandidate.personId` inside is `P012`.
- `2026-09-07T12-48-33-560Z_p004-patch-investigation.json` —
  P012's reevaluation after the bounded public acquisition.

The P012 acquisition is recorded in
[research/semantic-native/real-evidence/p012-acquisition-01/](research/semantic-native/real-evidence/p012-acquisition-01/):

- [acquisition-log.md](research/semantic-native/real-evidence/p012-acquisition-01/acquisition-log.md)
- [evidence-result.md](research/semantic-native/real-evidence/p012-acquisition-01/evidence-result.md)

Outcome: **EVIDENCE_NOT_FOUND**. Final relationship outcome:
**`surface_uncertain`**. The P012 decisive unknown and acquisition
plan were materially different from P004's
(iteration on **internal expert-service** workflow vs P004's
**interactive claim-to-evidence surface**), and the same runtime
produced a different final outcome
(`surface_uncertain` vs `surface_worth_exploring`) without any
runtime change.

## 2. Core architecture observed in the POC

> **Status: OBSERVED BUT NOT GENERALIZED.** The diagram below is
> what the POC actually executed. It is not presented as a
> universal architecture.

```
Situation
   ↓
Relationship Discovery
   ↓
Falsification
   ↓
Transfer Mechanism          (derived interpretation, not a label)
   ↓
Decisive Unknown             (single, relationship-specific gap)
   ↓
Required Evidence            (natural-language semantic description)
   ↓
Evidence Holder / Source     (named or describable, with justification)
   ↓
Acquisition Route            (legitimate path, not impersonating the holder)
   ↓
Acquisition Action           (smallest next action, not a workflow)
   ↓
Evidence Outcome             (EVIDENCE_FOUND | EVIDENCE_NOT_FOUND)
   ↓
Relationship Reevaluation    (exactly one model call, exactly one outcome)
   ↓
Product Action               (surface_worth_exploring | surface_uncertain | do_not_surface)
```

Concrete references:

- The transfer-mechanism and decisive-unknown stages are produced
  by `identifyEvidenceGap` in
  [matching/recruiting-poc/investigation/runtime.ts](matching/recruiting-poc/investigation/runtime.ts),
  prompted by `buildInvestigationQuestionPrompt` in
  [matching/recruiting-poc/investigation/prompt.ts](matching/recruiting-poc/investigation/prompt.ts).
- The required-evidence / holder / route / action stages are
  produced by `planAcquisition` in the same runtime, prompted by
  `buildAcquisitionPlanPrompt`. The plan schema is defined in
  [matching/recruiting-poc/investigation/parse.ts](matching/recruiting-poc/investigation/parse.ts) and explicitly disallows
  treating the current user as the evidence holder unless
  established by the evidence itself.
- The evidence-outcome stage is the bounded public acquisition
  pass recorded in `p004-acquisition-01/` and `p012-acquisition-01/`.
  The raw outcome is ingested as a new semantic-evidence field
  (`AcquisitionOutcome`) on the investigation state without
  normalization into a profile, skill, score, or taxonomy.
- The reevaluation stage uses `buildAcquisitionReevaluationPrompt`
  (added in the P004 reevaluation cycle) and reuses the existing
  `parseReevaluation` schema. The three product outcomes
  (`surface_worth_exploring`, `surface_uncertain`, `do_not_surface`)
  are the only allowed outputs.

## 3. Important methodological findings

### 3.1 Shared semantic similarity ≠ transferable capability

**VERIFIED BY POC.** [research/semantic-native/real-evidence/collision-01/relationship-falsification.md](research/semantic-native/real-evidence/collision-01/relationship-falsification.md)
documents the cross-relationship finding that converting a shared
tension into a meta-capability was the dominant false-positive
pattern (P003, P006 partial, P008). P004 and P012, which SURVIVE,
are the cases where the falsification file concludes that the
mechanism is more specific than generic transparency or iteration
alike.

### 3.2 Relationship judgment ≠ epistemic certainty

**VERIFIED BY POC.** Both P004 and P012 received an initial
`worth_exploring` judgment from the relationship-discovery stage
and a `SURVIVES` verdict from the falsification stage. Neither
initial judgment is treated as a final claim about the underlying
capability; both are explicitly preserved as conditional
hypotheses that the reevaluation stage is allowed to confirm,
downgrade, or reject.

### 3.3 EVIDENCE_NOT_FOUND ≠ evidence of absence

**VERIFIED BY POC.** Both reevaluation prompts
(`buildReevaluationPrompt` and `buildAcquisitionReevaluationPrompt`)
and both acquisition-result files explicitly carry this rule. The
P004 reevaluation and the P012 reevaluation each used the rule to
avoid penalizing the relationship for the bounded acquisition's
unresolved route.

### 3.4 Acquisition outcome may still provide negative information

**VERIFIED BY POC.** EVIDENCE_NOT_FOUND here is not zero
information. The P012 evidence-result file
([research/semantic-native/real-evidence/p012-acquisition-01/evidence-result.md](research/semantic-native/real-evidence/p012-acquisition-01/evidence-result.md))
records three concrete missing links (expert-service context;
judgment/trust preservation; durable reusable capability). Those
three missing links were carried into the P012 reevaluation prompt
as semantic evidence, and the model used them to downgrade the
relationship from `surface_worth_exploring` (P004) to
`surface_uncertain` (P012) without any runtime change.

### 3.5 Unknown ≠ missing form field

**VERIFIED BY POC.** The decisive unknown is generated by the
runtime as a natural-language semantic description, not a slot in
a candidate profile, skill, score, or taxonomy. The prompt
(`buildInvestigationQuestionPrompt`) explicitly forbids those
fields. The runtime is also forbidden from emitting skills,
requirements, profiles, scores, taxonomies, tags, or capability
categories.

### 3.6 Unknown ≠ automatically ask current user

**VERIFIED BY POC.** The acquisition-plan schema in
[matching/recruiting-poc/investigation/parse.ts](matching/recruiting-poc/investigation/parse.ts) is a
discriminated union: a `humanQuestion` is permitted only when
`currentUserIsAppropriateEvidenceHolder === true`, and that flag
is true only when the supplied evidence establishes the current
user as the legitimate holder. In both P004 and P012, the
acquisition plan emitted `currentUserIsAppropriateEvidenceHolder:
false` and `humanQuestion: null`. There is a focused test
("rejects a human question when the current user is not
semantically justified") in
[tests/unit/recruiting-poc/investigation/runtime.test.ts](tests/unit/recruiting-poc/investigation/runtime.test.ts) that
asserts this contract.

### 3.7 Investigation target can be relationship-generated rather than schema-generated

**VERIFIED BY POC.** The decisive unknown is generated per
relationship by the model from the relationship candidate and the
original evidence, not selected from a pre-existing schema. The
P004 and P012 decisive unknowns are independent strings produced
by the same prompt; they share no template and no taxonomy.

## 4. Known limitations

1. **Single-employer evidence pool.** Only one employer situation
   (Patch) was used. Whether the runtime generalizes to other
   employers is **UNTESTED HYPOTHESIS**.
2. **Two SURVIVES relationships completed the full loop.** The
   reevaluation stage was only exercised on P004 and P012. The
   falsification stage produced two additional verdicts
   (`WEAK`: P006, P010; `FAILS`: P003, P008) that did not proceed
   to acquisition or reevaluation. Whether the reevaluation would
   confirm, downgrade, or reject them is **UNTESTED HYPOTHESIS**.
3. **No traditional baseline comparison.** The POC was not
   compared to a conventional recruiting-pipeline baseline
   (resumes, keyword matching, employer-side skill filters,
   recruiter sourcing, ATS ranking, etc.). Whether the
   relationship-first loop produces a different and more
   evidence-grounded result is **UNTESTED HYPOTHESIS**.
4. **No scale, cost, or latency study.** Each relationship loop
   was run by hand and by a single human operator. Throughput,
   cost per relationship, and end-to-end latency were not
   measured. **UNTESTED HYPOTHESIS** that the approach is
   economically viable at any given scale.
5. **No real candidate or employer transaction.** No candidate
   was contacted. No employer-side process was opened. The
   "product action" in the diagram is a status, not an outcome.
   Whether the action would have produced a real conversation,
   interview, hire, or mutual agreement is **UNTESTED
   HYPOTHESIS**.
6. **No hiring outcome.** The POC stops at the
   `surface_worth_exploring / surface_uncertain / do_not_surface`
   boundary. It does not record, predict, or measure any
   downstream hiring result.
7. **No user-value or payment validation.** The product is not
   priced, sold, or consumed by an external user in the POC.
   Whether the surface produced by the POC has user value worth
   paying for is **UNTESTED HYPOTHESIS**.
8. **No claim that schemas are universally unnecessary.** The
   POC's deliberate absence of skill / score / taxonomy / tag
   fields is a property of the slice exercised. Whether a future
   stage, with different evidence requirements, would benefit
   from any of those structures is **UNTESTED HYPOTHESIS**.
9. **Person-side evidence was independently acquired but already
   semantically reconstructed.** The pilot-01 sources are
   short factual paraphrases of public professional material,
   not raw primary documents. The person-side evidence used by
   the runtime is the reconstruction in
   [research/semantic-native/real-evidence/pilot-01/sources/P00X.md](research/semantic-native/real-evidence/pilot-01/sources/),
   not the underlying article. The Collision-01 file
   [research/semantic-native/real-evidence/collision-01/relationship-discovery.md](research/semantic-native/real-evidence/collision-01/relationship-discovery.md) is a further
   interpretive layer on top of those reconstructions.
10. **Public evidence pool has high semantic density.** The
    admitted sources were selected for concreteness (situation,
    decision, outcome). Whether the runtime's decisive-unknown
    generator produces useful, single-gap unknowns on a pool
    with more diffuse or less bounded evidence is **UNTESTED
    HYPOTHESIS**.
11. **Bounded public acquisition depended on available web
    retrieval.** Both the P004 and P012 acquisition passes were
    bounded by what the retrieval environment could reach
    (web-search backend auth failure; LinkedIn / personal
    sites / institutional blogs returning 403/404/999; Wayback
    unreachable). EVIDENCE_NOT_FOUND in both cases is at least
    partly an artifact of the retrieval environment, not a
    general claim about the absence of evidence. This is
    explicitly recorded in both
    [research/semantic-native/real-evidence/p004-acquisition-01/acquisition-log.md](research/semantic-native/real-evidence/p004-acquisition-01/acquisition-log.md) and
    [research/semantic-native/real-evidence/p012-acquisition-01/acquisition-log.md](research/semantic-native/real-evidence/p012-acquisition-01/acquisition-log.md)
    and is part of why EVIDENCE_NOT_FOUND is **not** treated as
    proof of absence.
12. **Mechanical artifact-naming bug.** The
    `writeInvestigationArtifact` helper in
    [matching/recruiting-poc/investigation/artifact.ts](matching/recruiting-poc/investigation/artifact.ts) writes a
    fixed-filename `_p004-patch-investigation.json` regardless
    of the `relationshipCandidate.personId`. The P012 run
    therefore lives at
    `artifacts/recruiting-poc/investigation/2026-09-07T11-59-34-815Z_p004-patch-investigation.json`
    and
    `artifacts/recruiting-poc/investigation/2026-09-07T12-48-33-560Z_p004-patch-investigation.json`,
    even though the file body is the P012 × Patch state. The
    P012 reevaluation CLI guards on
    `relationshipCandidate.personId === 'P012'` to confirm
    it is loading the right file. This is recorded here as a
    known mechanical artifact-naming bug and is **not** fixed
    in this audit task.

## 5. P004 vs P012 — observed generalization

**Status: OBSERVED BUT NOT GENERALIZED.** This is what the POC
demonstrated on these two cases; it is not a claim about the
universe of relationships.

| Dimension | P004 × Patch | P012 × Patch |
|---|---|---|
| Relationship candidate personId | `P004` (Singer-Vine) | `P012` (Llobrera) |
| Source of person evidence | Collision-01 reconstruction | pilot-01 source reconstruction |
| Transfer mechanism (derived) | Layered claim-to-evidence path with conditional disclosure | Disciplined iterative workflow evolution on live work, with observation and cross-project learning |
| Decisive unknown (derived) | Whether the static claim-evidence architecture was translated into an interactive surface for a non-author | Whether the iterative workflow-evolution practice was applied to internal expert-service operations where judgment and trust had to be preserved |
| Required evidence (derived) | A specific interactive, attributable surface with a non-author navigation path and an explicit disclosure boundary | An attributable first-person account of iteration on internal expert-service work, with judgment preservation and a durable reusable capability |
| Evidence holder (derived) | Singer-Vine or a collaborator | Mark Llobrera |
| Current user as holder | rejected (no evidence) | rejected (no evidence) |
| Human question emitted | none | none |
| Acquisition outcome | EVIDENCE_NOT_FOUND | EVIDENCE_NOT_FOUND |
| Final relationship outcome | `surface_worth_exploring` | `surface_uncertain` |
| Runtime used | unchanged | unchanged |
| Prompt used | unchanged | unchanged |
| Schema used | unchanged | unchanged |

The two decisive unknowns and two acquisition plans were
independently generated by the same prompt from the same runtime
on different inputs. The two reevaluations used the same prompt
on different inputs and produced different final outcomes. The
runtime was not tuned between the two runs.

## 6. Current strongest supported proposition

> The Semantic Native Recruiting POC can take a single
> relationship candidate and a single employer situation, derive
> a relationship-specific transfer mechanism and a
> relationship-specific decisive unknown, route the required
> evidence to a legitimate holder without impersonating them or
> leaning on the current operator, ingest a bounded public
> acquisition outcome as raw semantic evidence, and produce
> exactly one of three product outcomes that distinguish
> `worth_exploring` from `uncertain` from `do_not_surface`,
> without introducing skills, scores, profiles, tags, or
> taxonomies, and without using a different runtime or prompt
> when the relationship changes.

This is supported by the P004 and P012 artifacts listed above and
by the test coverage in
[tests/unit/recruiting-poc/investigation/](tests/unit/recruiting-poc/investigation/),
which enforces the parse contracts and the per-stage
state-transition rules.

## 7. Current strongest falsifier

> The reevaluation outcome is driven by the acquisition outcome
> rather than by the relationship.

If a future pass showed that two relationships with materially
different decisive unknowns and materially different acquisition
plans received the same product outcome purely because both
acquisitions returned EVIDENCE_NOT_FOUND, that would falsify the
claim that the relationship itself carries weight. The P004 and
P012 runs in this POC already partially address this: P004 and
P012 had different decisive unknowns, different acquisition
plans, and the same EVIDENCE_NOT_FOUND outcome, and the runtime
produced different final outcomes
(`surface_worth_exploring` vs `surface_uncertain`). This is one
data point, not a falsification. A second, independent
acquisition that returns EVIDENCE_NOT_FOUND and produces the
same product outcome for the same relationship would
**strengthen** the supported proposition; a change in product
outcome for the same relationship would **weaken** it.

## 8. Next unanswered product question

> Does the `surface_worth_exploring` / `surface_uncertain` /
> `do_not_surface` boundary, when used to surface a relationship
> to a real product user, produce a downstream signal that the
> user finds more useful than the conventional
> resume / keyword / fit-score alternatives?

This is **UNTESTED HYPOTHESIS**. The POC stops at the boundary
and does not open any downstream product surface to a real
user. Whether the boundary is useful, calibrated, or
over-/under-cautious in practice is not established by anything
in this audit.

## 9. Records reviewed

- [research/semantic-native/real-evidence/pilot-01/README.md](research/semantic-native/real-evidence/pilot-01/README.md)
- [research/semantic-native/real-evidence/pilot-01/acquisition-log.ndjson](research/semantic-native/real-evidence/pilot-01/acquisition-log.ndjson)
- [research/semantic-native/real-evidence/pilot-01/sources/P001.md](research/semantic-native/real-evidence/pilot-01/sources/P001.md) through [P012.md](research/semantic-native/real-evidence/pilot-01/sources/P012.md)
- [research/semantic-native/real-evidence/employer-01/README.md](research/semantic-native/real-evidence/employer-01/README.md)
- [research/semantic-native/real-evidence/employer-01/sources.md](research/semantic-native/real-evidence/employer-01/sources.md)
- [research/semantic-native/real-evidence/employer-01/raw-employer-expression.md](research/semantic-native/real-evidence/employer-01/raw-employer-expression.md)
- [research/semantic-native/real-evidence/employer-01/evidence-reconstruction.md](research/semantic-native/real-evidence/employer-01/evidence-reconstruction.md)
- [research/semantic-native/real-evidence/collision-01/relationship-discovery.md](research/semantic-native/real-evidence/collision-01/relationship-discovery.md)
- [research/semantic-native/real-evidence/collision-01/relationship-falsification.md](research/semantic-native/real-evidence/collision-01/relationship-falsification.md)
- [research/semantic-native/real-evidence/p004-acquisition-01/acquisition-log.md](research/semantic-native/real-evidence/p004-acquisition-01/acquisition-log.md)
- [research/semantic-native/real-evidence/p004-acquisition-01/evidence-result.md](research/semantic-native/real-evidence/p004-acquisition-01/evidence-result.md)
- [research/semantic-native/real-evidence/p012-acquisition-01/acquisition-log.md](research/semantic-native/real-evidence/p012-acquisition-01/acquisition-log.md)
- [research/semantic-native/real-evidence/p012-acquisition-01/evidence-result.md](research/semantic-native/real-evidence/p012-acquisition-01/evidence-result.md)
- [matching/recruiting-poc/investigation/runtime.ts](matching/recruiting-poc/investigation/runtime.ts)
- [matching/recruiting-poc/investigation/state.ts](matching/recruiting-poc/investigation/state.ts)
- [matching/recruiting-poc/investigation/parse.ts](matching/recruiting-poc/investigation/parse.ts)
- [matching/recruiting-poc/investigation/prompt.ts](matching/recruiting-poc/investigation/prompt.ts)
- [matching/recruiting-poc/investigation/artifact.ts](matching/recruiting-poc/investigation/artifact.ts)
- [matching/recruiting-poc/investigation/fixture.ts](matching/recruiting-poc/investigation/fixture.ts)
- [matching/recruiting-poc/investigation/resume.ts](matching/recruiting-poc/investigation/resume.ts)
- [tests/unit/recruiting-poc/investigation/runtime.test.ts](tests/unit/recruiting-poc/investigation/runtime.test.ts)
- [tests/unit/recruiting-poc/investigation/acquisition-outcome.test.ts](tests/unit/recruiting-poc/investigation/acquisition-outcome.test.ts)
- [scripts/recruiting-poc-investigation-cli.ts](scripts/recruiting-poc-investigation-cli.ts)
- [scripts/recruiting-poc-acquisition-plan-cli.ts](scripts/recruiting-poc-acquisition-plan-cli.ts)
- [scripts/recruiting-poc-acquisition-outcome-cli.ts](scripts/recruiting-poc-acquisition-outcome-cli.ts)
- [scripts/recruiting-poc-p012-acquisition-cli.ts](scripts/recruiting-poc-p012-acquisition-cli.ts)
- [scripts/recruiting-poc-p012-acquisition-outcome-cli.ts](scripts/recruiting-poc-p012-acquisition-outcome-cli.ts)
- All five investigation artifacts in [artifacts/recruiting-poc/investigation/](artifacts/recruiting-poc/investigation/)
