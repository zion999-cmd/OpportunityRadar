import { z } from 'zod';
import { extractJsonObject } from '../../runtime/hermes/parse.js';

// matching/discovery/parse.ts — turn Hermes's stdout into a
// typed DiscoveryOutput.
//
// Reuses `extractJsonObject` (the last-balanced-brace JSON
// extractor) from runtime/hermes/parse.ts. This module does not
// import anything else from `runtime/hermes/*`.
//
// The schema reuses the same 3-value judgment enum as the
// bilateral matching POC. Per-relationship shape is the same
// 5-field structure (judgment / analysis / evidence / unknowns /
// nextStep). The new top-level shape is { summary, relationships }.

export const relationshipJudgmentSchema = z.enum([
  'worth_exploring',
  'uncertain',
  'unlikely',
]);

export const discoveredRelationshipSchema = z.object({
  recruitingId: z.string(),
  applyingId: z.string(),
  judgment: relationshipJudgmentSchema,
  analysis: z.string(),
  evidence: z.array(z.string()),
  unknowns: z.array(z.string()),
  nextStep: z.string(),
});

export const discoveryOutputSchema = z.object({
  summary: z.string(),
  relationships: z.array(discoveredRelationshipSchema),
});

export type DiscoveredRelationship = z.infer<typeof discoveredRelationshipSchema>;
export type DiscoveryOutput = z.infer<typeof discoveryOutputSchema>;

export function parseDiscoveryOutput(stdout: string): DiscoveryOutput {
  const raw = extractJsonObject(stdout);
  const parsed = discoveryOutputSchema.safeParse(raw);
  if (!parsed.success) {
    const first = parsed.error.issues[0];
    const path = first?.path.join('.') ?? '<root>';
    throw new Error(
      `parseDiscoveryOutput: failed schema validation at ${path}: ${first?.message ?? 'unknown'}`,
    );
  }
  return parsed.data;
}
