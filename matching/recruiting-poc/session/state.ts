// matching/recruiting-poc/session/state.ts —
// the minimal native session state for the Product Spine.
//
// Per the spec, the session state has exactly two domain
// fields:
//
//   - rawSituation         : the user's original situation
//                            (verbatim, no conversion)
//   - rawIntentEvidence    : the timeline of the user's
//                            natural-language clarifications,
//                            appended verbatim after each
//                            system question
//
// Plus one piece of session-level execution metadata:
//
//   - askCount             : how many times the runtime
//                            returned `action: ask` so far;
//                            used to enforce the 2-ask
//                            interaction budget (Stage 0 §5).
//
// This module does not introduce any Job, JobProfile,
// CandidateProfile, requirements[], skills[], tags[],
// filters[], hardConstraints[], or preference schema. The
// state is the raw inputs and the raw clarifications,
// nothing else.

export interface SessionState {
  readonly rawSituation: string;
  readonly rawIntentEvidence: ReadonlyArray<string>;
  readonly askCount: number;
}

export const MAX_ASK_BUDGET = 2;

export function createInitialState(rawSituation: string): SessionState {
  return {
    rawSituation,
    rawIntentEvidence: [],
    askCount: 0,
  };
}

export function appendIntentEvidence(
  state: SessionState,
  answer: string,
): SessionState {
  return {
    rawSituation: state.rawSituation,
    rawIntentEvidence: [...state.rawIntentEvidence, answer],
    askCount: state.askCount,
  };
}

export function incrementAskCount(state: SessionState): SessionState {
  return {
    rawSituation: state.rawSituation,
    rawIntentEvidence: state.rawIntentEvidence,
    askCount: state.askCount + 1,
  };
}

export function isBudgetExhausted(state: SessionState): boolean {
  return state.askCount >= MAX_ASK_BUDGET;
}
