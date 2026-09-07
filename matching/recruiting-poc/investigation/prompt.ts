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

Determine what evidence would resolve or materially change this unknown, who or what could legitimately supply it, the appropriate route to obtain it, and the next acquisition action. These must be natural-language semantic descriptions, not taxonomy labels. Do not invent the evidence, browse, contact anyone, perform acquisition, or reevaluate the relationship. The current user is merely operating this runtime: do not assume they are the evidence holder. A humanQuestion may be supplied only if the current user is specifically established by the provided evidence as an appropriate holder; otherwise currentUserIsAppropriateEvidenceHolder must be false and humanQuestion must be null. acquisitionAction must describe the legitimate next action without impersonating or directly addressing an absent holder.

On the last line output one strict JSON object with exactly: {"requiredEvidence":"...","evidenceHolder":"...","acquisitionRoute":"...","acquisitionAction":"...","currentUserIsAppropriateEvidenceHolder":false,"recipientJustification":"...","humanQuestion":null}`;
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

EPISTEMIC RULE — read carefully:
The acquisition outcome is one of EVIDENCE_FOUND or EVIDENCE_NOT_FOUND. EVIDENCE_NOT_FOUND means the bounded public acquisition did not establish the required transfer evidence; it does NOT mean the underlying capability does not exist. Do not convert absence of discovered public evidence into evidence of absence. Do not penalize the relationship merely because the route terminated as unresolved.

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
