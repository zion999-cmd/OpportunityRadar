import type { InvestigationState } from './state.js';

const METHOD = `A transfer mechanism is the evidence-grounded reason why a capability demonstrated in one past situation could plausibly contribute to changing the current situation. It is not shared keywords, occupation, industry, technology, abstract tension, or a generic capability. Investigation is relationship-specific: seek only the smallest missing piece of evidence that could materially change whether this mechanism is credible. Do not create skills, requirements, profiles, scores, taxonomies, tags, or capability categories.`;

export function buildInvestigationQuestionPrompt(state: InvestigationState): string {
  return `You are checking a discovered recruiting relationship before it may be surfaced.

${METHOD}

RELATIONSHIP CANDIDATE
${JSON.stringify(state.relationshipCandidate, null, 2)}

ORIGINAL EVIDENCE (preserve its meaning; distinguish evidence from your interpretation)
---
${state.originalEvidence}
---

Identify the specific transfer mechanism and the single decisive unknown. Do not formulate a question or assume who holds the missing evidence; acquisition routing happens in the next stage. Do not decide the final surface outcome yet.

On the last line output one strict JSON object with exactly: {"transferMechanism":"...","decisiveUnknown":"..."}`;
}

export function buildReevaluationPrompt(state: InvestigationState): string {
  if (state.investigationEvidence === null || state.transferMechanism === null || state.decisiveUnknown === null) {
    throw new Error('buildReevaluationPrompt: investigation evidence is required');
  }
  return `You are reevaluating one recruiting relationship after one relationship-specific investigation answer.

${METHOD}

RELATIONSHIP CANDIDATE
${JSON.stringify(state.relationshipCandidate, null, 2)}

TRANSFER MECHANISM (derived interpretation)
${state.transferMechanism}

DECISIVE UNKNOWN (derived interpretation)
${state.decisiveUnknown}

ORIGINAL EVIDENCE
---
${state.originalEvidence}
---

NEW RAW INVESTIGATION EVIDENCE (verbatim; do not normalize it)
Question: ${state.investigationEvidence.question}
Answer:
---
${state.investigationEvidence.rawAnswer}
---

Reevaluate using both the original evidence and the new raw evidence. Do not ask another question. Choose exactly one outcome: surface_worth_exploring, surface_uncertain, or do_not_surface.

On the last line output one strict JSON object with exactly: {"outcome":"...","reasoning":"...","evidenceUsed":["..."],"remainingUncertainty":["..."]}`;
}

export function buildAcquisitionPlanPrompt(state: InvestigationState): string {
  if (state.transferMechanism === null || state.decisiveUnknown === null) {
    throw new Error('buildAcquisitionPlanPrompt: transfer mechanism and decisive unknown are required');
  }
  return `You are routing acquisition of the smallest missing evidence for one recruiting relationship.

${METHOD}

RELATIONSHIP CANDIDATE
${JSON.stringify(state.relationshipCandidate, null, 2)}

TRANSFER MECHANISM (derived interpretation)
${state.transferMechanism}

DECISIVE UNKNOWN (derived interpretation)
${state.decisiveUnknown}

ORIGINAL EVIDENCE
---
${state.originalEvidence}
---

Determine what evidence would resolve or materially change this unknown, who or what could legitimately supply it, the appropriate route to obtain it, and the next acquisition action. These must be natural-language semantic descriptions, not taxonomy labels. Do not invent the evidence, browse, contact anyone, perform acquisition, or reevaluate the relationship. The current user is operating this runtime; decide from the provided evidence alone whether the current user is the appropriate evidence holder. If the evidence specifically establishes the current user as the appropriate holder, currentUserIsAppropriateEvidenceHolder must be true and humanQuestion must be a non-empty natural-language question that, if answered, would resolve or materially change the decisive unknown. Otherwise currentUserIsAppropriateEvidenceHolder must be false and humanQuestion must be null. acquisitionAction must describe the legitimate next action without impersonating or directly addressing an absent holder. Preserve recipientJustification in either branch.

On the last line output exactly one strict JSON object — pick the shape that matches the branch the evidence supports, with no extra fields and no other variants:

If currentUserIsAppropriateEvidenceHolder is true:
{"requiredEvidence":"...","evidenceHolder":"...","acquisitionRoute":"...","acquisitionAction":"...","currentUserIsAppropriateEvidenceHolder":true,"recipientJustification":"...","humanQuestion":"..."}

If currentUserIsAppropriateEvidenceHolder is false:
{"requiredEvidence":"...","evidenceHolder":"...","acquisitionRoute":"...","acquisitionAction":"...","currentUserIsAppropriateEvidenceHolder":false,"recipientJustification":"...","humanQuestion":null}`;
}

export function buildAcquisitionReevaluationPrompt(state: InvestigationState): string {
  if (state.transferMechanism === null || state.decisiveUnknown === null) {
    throw new Error('buildAcquisitionReevaluationPrompt: transfer mechanism and decisive unknown are required');
  }
  if (state.acquisitionPlan === null) {
    throw new Error('buildAcquisitionReevaluationPrompt: acquisition plan is required');
  }
  if (state.acquisitionOutcome === null) {
    throw new Error('buildAcquisitionReevaluationPrompt: acquisition outcome is required');
  }
  return `You are reevaluating one recruiting relationship after one bounded public acquisition of the decisive-unknown evidence.

${METHOD}

EPISTEMIC RULE — read carefully (frozen):
EVIDENCE_NOT_FOUND is not evidence that the underlying capability is absent.

However, a bounded acquisition may still provide negative information.
Assess how informative the failure to find evidence is from the supplied acquisition
result itself — including coverage, source reachability, specificity of what was
sought, and concrete missing links — and update the relationship accordingly.

Do not treat EVIDENCE_NOT_FOUND as automatic failure.
Do not treat it as zero information.

RELATIONSHIP CANDIDATE
${JSON.stringify(state.relationshipCandidate, null, 2)}

TRANSFER MECHANISM (derived interpretation)
${state.transferMechanism}

DECISIVE UNKNOWN (derived interpretation)
${state.decisiveUnknown}

ORIGINAL EVIDENCE
---
${state.originalEvidence}
---

ACQUISITION PLAN (what was sought, verbatim from the prior stage)
${JSON.stringify(state.acquisitionPlan, null, 2)}

ACQUISITION OUTCOME (raw, ingested as semantic evidence; do not normalize it into a candidate profile, skill, score, or taxonomy)
Verdict: ${state.acquisitionOutcome.verdict}
Evidence-result artifact path: ${state.acquisitionOutcome.evidenceResultPath}
Acquisition-log artifact path: ${state.acquisitionOutcome.acquisitionLogPath ?? '<not provided>'}

Raw content of evidence-result artifact (verbatim):
---
${state.acquisitionOutcome.rawContent}
---

Reevaluate using the original evidence together with the raw acquisition outcome. Do not ask another question, do not run another acquisition, do not browse, do not contact anyone. Choose exactly one outcome: surface_worth_exploring, surface_uncertain, or do_not_surface. Preserve the acquisition query, the acquisition result, the evidence found or not found, and your interpretation of that result as distinct items. Cite the raw acquisition content where it is material to your decision.

On the last line output one strict JSON object with exactly: {"outcome":"...","reasoning":"...","evidenceUsed":["..."],"remainingUncertainty":["..."]}`;
}
