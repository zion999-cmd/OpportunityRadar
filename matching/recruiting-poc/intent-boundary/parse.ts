import { z } from 'zod';
import { extractJsonObject } from '../../../runtime/hermes/parse.js';

// matching/recruiting-poc/intent-boundary/parse.ts —
// parse Hermes's stdout into a typed IntentBoundaryOutput.
//
// Output schema (per Stage 2 §B1):
//   {
//     "question":              string,
//     "whyItMatters":          string,
//     "affectedRelationships": [
//        {
//          "candidateId":  string,
//          "ifAnswerA":    string,
//          "ifAnswerB":    string,
//        },
//        ...
//     ],
//     "evidence": [string, ...]
//   }
//
// `affectedRelationships` is 1..N — at least one candidate's
// judgment must shift, otherwise the question has no payoff.
// The `candidateId` values are not validated against the pool
// here: we do not know which candidates the LLM is willing
// to discuss without seeing its output, and the artifact is
// the source of truth for what the model emitted. The CLI
// may cross-reference with the pool when it renders.

export const affectedRelationshipSchema = z.object({
  candidateId: z.string(),
  ifAnswerA: z.string(),
  ifAnswerB: z.string(),
});

export const intentBoundaryOutputSchema = z.object({
  question: z.string(),
  whyItMatters: z.string(),
  affectedRelationships: z.array(affectedRelationshipSchema).min(1),
  evidence: z.array(z.string()),
});

export type AffectedRelationship = z.infer<typeof affectedRelationshipSchema>;
export type IntentBoundaryOutput = z.infer<typeof intentBoundaryOutputSchema>;

export function parseIntentBoundaryOutput(stdout: string): IntentBoundaryOutput {
  const raw = extractJsonObject(stdout);
  const parsed = intentBoundaryOutputSchema.safeParse(raw);
  if (!parsed.success) {
    const first = parsed.error.issues[0];
    const path = first?.path.join('.') ?? '<root>';
    throw new Error(
      `parseIntentBoundaryOutput: failed schema validation at ${path}: ${first?.message ?? 'unknown'}`,
    );
  }
  return parsed.data;
}
