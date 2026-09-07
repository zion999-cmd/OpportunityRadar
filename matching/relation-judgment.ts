import { z } from 'zod';

// matching/relation-judgment.ts — Semantic-Native POC output schema.
//
// Deliberately loose. The POC's job is to *observe* how a model
// reasons about bilateral natural-language material, not to force
// a reasoning taxonomy up front. Five fields:
//
//   judgment   : one of three coarse values; the only "scoring" in
//                the POC. If even this is premature for the next
//                iteration, widen to a free-text verdict.
//   analysis   : free text. The model's own paragraph explaining
//                its judgment.
//   evidence   : free-text list. Entries MAY be prefixed with
//                [OBSERVED] / [INFERRED] / [CONFLICT] by the model
//                for human readability; the schema does not enforce
//                the prefix.
//   unknowns   : free-text list. Things the model could not tell
//                from the input material.
//   nextStep   : one short concrete next action.
//
// The schema does NOT encode:
//   - observed-vs-inferred as separate fields (the model's prose
//     in `evidence` carries whatever structure the model chose);
//   - per-side evidence split (a single list keeps the model from
//     over-balancing);
//   - a match score, a probability, a weight, a confidence.

export const relationJudgmentSchema = z.object({
  judgment: z.enum(['worth_exploring', 'uncertain', 'unlikely']),
  analysis: z.string(),
  evidence: z.array(z.string()),
  unknowns: z.array(z.string()),
  nextStep: z.string(),
});
export type RelationJudgment = z.infer<typeof relationJudgmentSchema>;
