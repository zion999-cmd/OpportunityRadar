import { z } from 'zod';
import { extractJsonObject } from '../../../runtime/hermes/parse.js';
import { discoveredCandidateRelationshipSchema } from '../parse.js';

// matching/recruiting-poc/session/parse.ts —
// the runtime-decision Zod schema and parser for the
// Product Spine.
//
// Two parsers, used in different contexts:
//
//   - parseRuntimeDecision(stdout): used for the
//     decision-mode prompt. Accepts a JSON object that is
//     either { action: "ask", question, whyItMatters } or
//     { action: "surface", relationships[] }.
//
//   - parseForcedSurfaceDecision(stdout): used for the
//     forced-surface prompt after the 2-ask budget is
//     exhausted. Accepts a JSON object that is exactly
//     { relationships[] } (no ask option; the model has
//     been told it MUST surface).
//
// The 5-field relationship shape is the same one used in
// Stage 1 / Stage 3 and is re-used here via the existing
// schema. We do not introduce a new relationship shape.

const relationshipArray = z.array(discoveredCandidateRelationshipSchema);

const askDecisionSchema = z.object({
  action: z.literal('ask'),
  question: z.string().min(1),
  whyItMatters: z.string().min(1),
});

const surfaceDecisionSchema = z.object({
  action: z.literal('surface'),
  relationships: relationshipArray,
});

export const runtimeDecisionSchema = z.discriminatedUnion('action', [
  askDecisionSchema,
  surfaceDecisionSchema,
]);

export type AskDecision = z.infer<typeof askDecisionSchema>;
export type SurfaceDecision = z.infer<typeof surfaceDecisionSchema>;
export type RuntimeDecision = z.infer<typeof runtimeDecisionSchema>;

export function parseRuntimeDecision(stdout: string): RuntimeDecision {
  const raw = extractJsonObject(stdout);
  const parsed = runtimeDecisionSchema.safeParse(raw);
  if (!parsed.success) {
    const first = parsed.error.issues[0];
    const path = first?.path.join('.') ?? '<root>';
    throw new Error(
      `parseRuntimeDecision: failed schema validation at ${path}: ${first?.message ?? 'unknown'}`,
    );
  }
  return parsed.data;
}

// `.strict()` so the model cannot sneak in arbitrary unknown
// keys. The `action` field is `optional` and, when present,
// MUST be the literal string "surface" — the prompt explicitly
// tells the model to emit
//   { "action": "surface", "relationships": [...] }
// and the schema must accept exactly that shape. Envelope-less
// `{ relationships: [...] }` is also accepted for backward
// compatibility with the previous (pre-fix) runtime. Any other
// action value (`"ask"`, `"maybe"`, etc.) is rejected at the
// schema level — the runtime already told the model to surface,
// and the parser enforces that contract. Relationship validation
// is unchanged: the 5-field shape is still required.
const forcedSurfaceDecisionSchema = z
  .object({
    action: z.literal('surface').optional(),
    relationships: relationshipArray,
  })
  .strict();

export type ForcedSurfaceDecision = z.infer<typeof forcedSurfaceDecisionSchema>;

export function parseForcedSurfaceDecision(stdout: string): SurfaceDecision {
  const raw = extractJsonObject(stdout);
  const parsed = forcedSurfaceDecisionSchema.safeParse(raw);
  if (!parsed.success) {
    const first = parsed.error.issues[0];
    const path = first?.path.join('.') ?? '<root>';
    throw new Error(
      `parseForcedSurfaceDecision: failed schema validation at ${path}: ${first?.message ?? 'unknown'}`,
    );
  }
  return { action: 'surface', relationships: parsed.data.relationships };
}
