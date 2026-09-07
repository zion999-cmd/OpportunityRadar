import type { HermesClient } from '../../../runtime/hermes/types.js';
import { parseAcquisitionPlan, parseInvestigationQuestion, parseReevaluation } from './parse.js';
import type { AcquisitionVerdict } from './parse.js';
import { buildAcquisitionPlanPrompt, buildAcquisitionReevaluationPrompt, buildInvestigationQuestionPrompt, buildReevaluationPrompt } from './prompt.js';
import type { AcquisitionOutcome, InvestigationState } from './state.js';

export interface InvestigationFailure {
  readonly stage: 'transfer_mechanism_check' | 'acquisition_planning' | 'relationship_reevaluation' | 'acquisition_reevaluation';
  readonly rawOutput: string;
  readonly error: string;
  readonly stateBefore: InvestigationState;
}

export class InvestigationModelOutputError extends Error {
  constructor(public readonly failure: InvestigationFailure) {
    super(`${failure.stage}: ${failure.error}`);
    this.name = 'InvestigationModelOutputError';
  }
}

export interface AcquisitionOutcomeIngest {
  readonly verdict: AcquisitionVerdict;
  readonly evidenceResultPath: string;
  readonly acquisitionLogPath: string | null;
  readonly rawContent: string;
}

export class RelationshipInvestigation {
  private state: InvestigationState;
  private readonly failures: InvestigationFailure[] = [];

  constructor(initialState: InvestigationState, private readonly client: HermesClient) {
    this.state = initialState;
  }

  get currentState(): InvestigationState { return this.state; }
  get preservedFailures(): ReadonlyArray<InvestigationFailure> { return this.failures.slice(); }

  async identifyEvidenceGap(): Promise<InvestigationState> {
    if (this.state.stage !== 'relationship_candidate') {
      throw new Error('identifyEvidenceGap: exactly one investigation question is permitted');
    }
    const stateBefore = this.state;
    const result = await this.client.oneShot({ prompt: buildInvestigationQuestionPrompt(stateBefore), safeMode: true });
    try {
      const decision = parseInvestigationQuestion(result.stdout);
      this.state = {
        ...stateBefore,
        stage: 'awaiting_acquisition',
        transferMechanism: decision.transferMechanism,
        decisiveUnknown: decision.decisiveUnknown,
        investigationEvidence: null,
        acquisitionOutcome: null,
        reevaluationResult: null,
      };
      return this.state;
    } catch (error) {
      this.fail('transfer_mechanism_check', result.stdout, error, stateBefore);
    }
  }

  async submitEvidence(rawAnswer: string): Promise<InvestigationState> {
    if (this.state.stage !== 'awaiting_investigation_evidence' || this.state.investigationEvidence === null) {
      throw new Error('submitEvidence: runtime is not waiting for investigation evidence');
    }
    const stateBefore: InvestigationState = {
      ...this.state,
      investigationEvidence: { ...this.state.investigationEvidence, rawAnswer },
    };
    this.state = stateBefore;
    const result = await this.client.oneShot({ prompt: buildReevaluationPrompt(stateBefore), safeMode: true });
    try {
      const decision = parseReevaluation(result.stdout);
      this.state = { ...stateBefore, stage: 'reevaluated', reevaluationResult: decision };
      return this.state;
    } catch (error) {
      this.fail('relationship_reevaluation', result.stdout, error, stateBefore);
    }
  }

  async planAcquisition(): Promise<InvestigationState> {
    if (this.state.stage !== 'awaiting_acquisition') {
      throw new Error('planAcquisition: runtime is not awaiting acquisition planning');
    }
    const stateBefore = this.state;
    const result = await this.client.oneShot({ prompt: buildAcquisitionPlanPrompt(stateBefore), safeMode: true });
    try {
      const plan = parseAcquisitionPlan(result.stdout);
      // Routing branch:
      //   currentUserIsAppropriateEvidenceHolder = false
      //     → remain in awaiting_acquisition; humanQuestion is null.
      //   currentUserIsAppropriateEvidenceHolder = true
      //     → transition to awaiting_investigation_evidence;
      //       preserve the human question for raw-answer submission;
      //       rawAnswer remains empty.
      if (plan.currentUserIsAppropriateEvidenceHolder) {
        this.state = {
          ...stateBefore,
          stage: 'awaiting_investigation_evidence',
          acquisitionPlan: plan,
          investigationEvidence: { question: plan.humanQuestion, rawAnswer: '' },
        };
      } else {
        this.state = { ...stateBefore, acquisitionPlan: plan };
      }
      return this.state;
    } catch (error) {
      this.fail('acquisition_planning', result.stdout, error, stateBefore);
    }
  }

  /**
   * Ingest a raw bounded-acquisition outcome as new semantic evidence
   * and perform exactly one reevaluation model call. The acquisition
   * result, its source artifact paths, and the raw content are
   * preserved separately from any model interpretation. The method
   * does not trigger any further investigation or acquisition loop.
   */
  async submitAcquisitionOutcome(ingest: AcquisitionOutcomeIngest): Promise<InvestigationState> {
    if (this.state.stage !== 'awaiting_acquisition') {
      throw new Error('submitAcquisitionOutcome: runtime is not awaiting an acquisition outcome');
    }
    if (this.state.acquisitionPlan === null) {
      throw new Error('submitAcquisitionOutcome: acquisition plan is required before outcome ingest');
    }
    const acquisitionOutcome: AcquisitionOutcome = {
      verdict: ingest.verdict,
      evidenceResultPath: ingest.evidenceResultPath,
      acquisitionLogPath: ingest.acquisitionLogPath,
      rawContent: ingest.rawContent,
    };
    const stateBefore: InvestigationState = { ...this.state, acquisitionOutcome };
    this.state = stateBefore;
    const result = await this.client.oneShot({ prompt: buildAcquisitionReevaluationPrompt(stateBefore), safeMode: true });
    try {
      const decision = parseReevaluation(result.stdout);
      this.state = { ...stateBefore, stage: 'reevaluated', reevaluationResult: decision };
      return this.state;
    } catch (error) {
      this.fail('acquisition_reevaluation', result.stdout, error, stateBefore);
    }
  }

  private fail(stage: InvestigationFailure['stage'], rawOutput: string, error: unknown, stateBefore: InvestigationState): never {
    const failure = { stage, rawOutput, error: error instanceof Error ? error.message : String(error), stateBefore };
    this.failures.push(failure);
    throw new InvestigationModelOutputError(failure);
  }
}
