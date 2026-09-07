import { z } from 'zod';
import { extractJsonObject } from '../runtime/hermes/parse.js';

// semantic-completion/parse.ts — Zod schemas + parsers for this
// experiment's two output shapes.
//
//   CompletionOutput    — the 3-region completion for one raw material
//   RelationshipOutput  — the 2-region relationship reasoning for A vs B
//
// Reuses `extractJsonObject` (the last-balanced-brace JSON
// extractor) from runtime/hermes/parse.ts. This module does not
// import anything else from `runtime/hermes/*`.
//
// The three completion regions
//   directly_supported  /  implied_meaning  /  hypotheses_and_unknowns
// and the two relationship regions
//   supported_reasoning /  still_needs_evidence
// are THIS experiment's epistemic boundary. They are NOT a generic
// domain schema or framework. The keys are kept in snake_case for
// Zod-friendly parsing; the prompts spell them in human form.

export const completionOutputSchema = z.object({
  directlySupported: z.string(),
  impliedMeaning: z.string(),
  hypothesesAndUnknowns: z.string(),
});

export const relationshipOutputSchema = z.object({
  supportedReasoning: z.string(),
  stillNeedsEvidence: z.string(),
});

export type CompletionOutput = z.infer<typeof completionOutputSchema>;
export type RelationshipOutput = z.infer<typeof relationshipOutputSchema>;

function parseZod<T>(
  stdout: string,
  schema: z.ZodType<T>,
  label: string,
): T {
  const raw = extractJsonObject(stdout);
  const parsed = schema.safeParse(raw);
  if (!parsed.success) {
    const first = parsed.error.issues[0];
    const path = first?.path.join('.') ?? '<root>';
    throw new Error(
      `${label}: failed schema validation at ${path}: ${first?.message ?? 'unknown'}`,
    );
  }
  return parsed.data;
}

export function parseCompletionOutput(stdout: string): CompletionOutput {
  return parseZod(stdout, completionOutputSchema, 'parseCompletionOutput');
}

export function parseRelationshipOutput(stdout: string): RelationshipOutput {
  return parseZod(stdout, relationshipOutputSchema, 'parseRelationshipOutput');
}
