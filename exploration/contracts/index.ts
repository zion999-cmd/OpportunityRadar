// Barrel for Exploration Contracts. P0002 §1-§4.

export { explorationGoalSchema, type ExplorationGoal } from './exploration-goal.js';
export {
  candidateSourceSchema,
  evidenceCandidateSchema,
  sourceTypeSchema,
  languageSchema,
  type CandidateSource,
  type EvidenceCandidate,
} from './evidence-candidate.js';
export { explorationResultSchema, type ExplorationResult } from './exploration-result.js';
