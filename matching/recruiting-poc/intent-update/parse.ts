// matching/recruiting-poc/intent-update/parse.ts —
// re-export the Stage 1 Zod schema and parser for Stage 3
// runs. The output shape is identical to Stage 1
// (summary + relationships with the 5-field shape).
//
// Stage 3 §3 ("Discovery Prompt / Output"): "Relationship
// output semantics" matches Stage 1 exactly, so the parser
// is shared, not duplicated.

export {
  parseFullPoolDiscoveryOutput,
  fullPoolDiscoveryOutputSchema,
  relationshipJudgmentSchema,
  discoveredCandidateRelationshipSchema,
} from '../parse.js';

export type {
  FullPoolDiscoveryOutput,
  FullPoolDiscoveredRelationship,
} from '../parse.js';
