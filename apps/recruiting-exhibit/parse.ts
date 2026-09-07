// apps/recruiting-exhibit/parse.ts — Zod-validated parsers for
// the two model output shapes produced by `prompts.ts`.
//
// The parsers reuse the shared `extractJsonObject` helper from
// the existing Hermes parse module so a model that wraps its
// output in prose still round-trips.

import { z } from 'zod';
import { extractJsonObject } from '../../runtime/hermes/parse.js';

const evidenceReconstructionSchema = z.object({
  directly_supported: z.string().min(1),
  implied_meaning: z.string().min(1),
  hypotheses_unknowns: z.string().min(1),
}).strict();
export type EvidenceReconstruction = z.infer<typeof evidenceReconstructionSchema>;

const relationshipReasoningSchema = z.object({
  surface_decision: z.enum(['surface', 'do_not_surface']),
  why_relevant: z.string().min(1),
  evidence_used: z.string().min(1),
  most_important_unknown: z.string().min(1),
}).strict();
export type RelationshipReasoning = z.infer<typeof relationshipReasoningSchema>;

function parseWith<T>(stdout: string, schema: z.ZodType<T>, name: string): T {
  const raw = extractJsonObject(stdout);
  const parsed = schema.safeParse(raw);
  if (!parsed.success) {
    const issue = parsed.error.issues[0];
    throw new Error(`${name}: failed schema validation at ${issue?.path.join('.') || '<root>'}: ${issue?.message ?? 'unknown'}`);
  }
  return parsed.data;
}

export function parseEvidenceReconstruction(stdout: string): EvidenceReconstruction {
  return parseWith(stdout, evidenceReconstructionSchema, 'parseEvidenceReconstruction');
}

export function parseRelationshipReasoning(stdout: string): RelationshipReasoning {
  return parseWith(stdout, relationshipReasoningSchema, 'parseRelationshipReasoning');
}
