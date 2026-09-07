import { z } from 'zod';
import { extractJsonObject } from '../../runtime/hermes/parse.js';

// matching/recruiting-poc/parse.ts — turn Hermes's stdout into
// a typed FullPoolDiscoveryOutput.
//
// Reuses `extractJsonObject` from runtime/hermes/parse.ts. This
// module does not import anything else from `runtime/hermes/*`.
//
// Per the Stage 1 spec, the judgment enum is binary:
//   "worth_exploring" | "uncertain"
//   ("unlikely" is intentionally absent — this is discovery, not
//    exhaustive classification; non-surfaced candidates are
//    simply not in the relationships array.)
//
// Per-relationship shape mirrors the 5-field output
// (analysis / evidence / unknowns / nextStep) used in
// `matching/discovery` and `matching/relation-judgment`.

export const relationshipJudgmentSchema = z.enum([
  'worth_exploring',
  'uncertain',
]);

export const discoveredCandidateRelationshipSchema = z.object({
  candidateId: z.string(),
  judgment: relationshipJudgmentSchema,
  analysis: z.string(),
  evidence: z.array(z.string()),
  unknowns: z.array(z.string()),
  nextStep: z.string(),
});

export const fullPoolDiscoveryOutputSchema = z.object({
  summary: z.string(),
  relationships: z.array(discoveredCandidateRelationshipSchema),
});

export type FullPoolDiscoveredRelationship = z.infer<typeof discoveredCandidateRelationshipSchema>;
export type FullPoolDiscoveryOutput = z.infer<typeof fullPoolDiscoveryOutputSchema>;

export function parseFullPoolDiscoveryOutput(stdout: string): FullPoolDiscoveryOutput {
  const raw = extractJsonObject(stdout);
  const parsed = fullPoolDiscoveryOutputSchema.safeParse(raw);
  if (!parsed.success) {
    const first = parsed.error.issues[0];
    const path = first?.path.join('.') ?? '<root>';
    throw new Error(
      `parseFullPoolDiscoveryOutput: failed schema validation at ${path}: ${first?.message ?? 'unknown'}`,
    );
  }
  return parsed.data;
}
