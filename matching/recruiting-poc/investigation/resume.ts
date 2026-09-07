import { readFileSync } from 'node:fs';
import type { InvestigationFailure } from './runtime.js';
import type { InvestigationState } from './state.js';

interface ArtifactEnvelope {
  readonly state: InvestigationState;
  readonly failures?: ReadonlyArray<InvestigationFailure>;
}

/** Resume the v0.2 live artifact without treating its prematurely-addressed question as evidence. */
export function readAcquisitionResumeState(path: string): {
  state: InvestigationState;
  failures: ReadonlyArray<InvestigationFailure>;
} {
  const envelope = JSON.parse(readFileSync(path, 'utf8')) as ArtifactEnvelope;
  if (!envelope.state?.decisiveUnknown || !envelope.state.transferMechanism) {
    throw new Error('readAcquisitionResumeState: preserved decisive unknown is missing');
  }
  const priorQuestion = envelope.state.investigationEvidence?.question ?? null;
  if ((envelope.state.investigationEvidence?.rawAnswer ?? '') !== '') {
    throw new Error('readAcquisitionResumeState: artifact already contains evidence');
  }
  return {
    state: {
      ...envelope.state,
      stage: 'awaiting_acquisition',
      acquisitionPlan: null,
      priorInvestigationQuestion: priorQuestion,
      investigationEvidence: null,
      reevaluationResult: null,
    },
    failures: envelope.failures ?? [],
  };
}
