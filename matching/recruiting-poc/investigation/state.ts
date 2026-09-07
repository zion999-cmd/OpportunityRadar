export type InvestigationOutcome =
  | 'surface_worth_exploring'
  | 'surface_uncertain'
  | 'do_not_surface';

export interface RelationshipCandidate {
  readonly personId: string;
  readonly employerId: string;
  readonly relationship: string;
}

export interface InvestigationEvidence {
  readonly question: string;
  readonly rawAnswer: string;
}

export interface AcquisitionPlan {
  readonly requiredEvidence: string;
  readonly evidenceHolder: string;
  readonly acquisitionRoute: string;
  readonly acquisitionAction: string;
  readonly currentUserIsAppropriateEvidenceHolder: boolean;
  readonly recipientJustification: string;
  readonly humanQuestion: string | null;
}

/**
 * The raw acquisition outcome, ingested into the investigation as
 * semantic evidence. It is preserved separately from any model
 * interpretation. It is never normalized into a profile, skill,
 * score, or taxonomy field.
 */
export interface AcquisitionOutcome {
  /** Frozen verdict from the bounded public acquisition. */
  readonly verdict: 'EVIDENCE_FOUND' | 'EVIDENCE_NOT_FOUND';
  /** Path to the acquisition evidence-result artifact, on disk. */
  readonly evidenceResultPath: string;
  /** Path to the acquisition-log artifact, on disk (if present). */
  readonly acquisitionLogPath: string | null;
  /** Verbatim raw content of the evidence-result artifact. */
  readonly rawContent: string;
}

export type InvestigationStage =
  | 'relationship_candidate'
  | 'awaiting_acquisition'
  | 'awaiting_investigation_evidence'
  | 'reevaluated';

export interface ReevaluationResult {
  readonly outcome: InvestigationOutcome;
  readonly reasoning: string;
  readonly evidenceUsed: ReadonlyArray<string>;
  readonly remainingUncertainty: ReadonlyArray<string>;
}

export interface InvestigationState {
  readonly stage: InvestigationStage;
  readonly relationshipCandidate: RelationshipCandidate;
  readonly originalEvidence: string;
  readonly transferMechanism: string | null;
  readonly decisiveUnknown: string | null;
  readonly acquisitionPlan: AcquisitionPlan | null;
  /** Preserves a question produced before acquisition routing existed. It is not emitted. */
  readonly priorInvestigationQuestion: string | null;
  readonly investigationEvidence: InvestigationEvidence | null;
  /**
   * The bounded acquisition outcome, preserved as raw semantic
   * evidence. Distinct from `investigationEvidence` (which is the
   * routed human answer) and from `reevaluationResult` (which is the
   * model's interpretation).
   */
  readonly acquisitionOutcome: AcquisitionOutcome | null;
  readonly reevaluationResult: ReevaluationResult | null;
}

export function createInvestigationState(
  relationshipCandidate: RelationshipCandidate,
  originalEvidence: string,
): InvestigationState {
  return {
    stage: 'relationship_candidate',
    relationshipCandidate,
    originalEvidence,
    transferMechanism: null,
    decisiveUnknown: null,
    acquisitionPlan: null,
    priorInvestigationQuestion: null,
    investigationEvidence: null,
    acquisitionOutcome: null,
    reevaluationResult: null,
  };
}
