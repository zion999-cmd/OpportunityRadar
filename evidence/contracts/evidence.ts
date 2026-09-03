import { z } from 'zod';
import { marketSchema, type Market } from './source-document.js';

// Evidence contract.
//
// Evidence is an atomic, externally observable factual claim with
// traceable provenance. It is the foundation layer of the Five
// Analytical Objects. Every Signal, Shift, Thesis, and Opportunity
// in later Proposals must be traceable to Evidence at this level.
//
// Per P0001 §Evidence, §Atomicity, §Confidence, §Temporal Semantics.

export const evidenceTypeSchema = z.enum([
  'funding',
  'valuation',
  'revenue',
  'growth',
  'customer_adoption',
  'product_launch',
  'acquisition',
  'policy',
  'technology_capability',
  'market_activity',
  'usage',
]);
export type EvidenceType = z.infer<typeof evidenceTypeSchema>;

export const confidenceSchema = z.enum([
  'primary',
  'corroborated',
  'reported',
  'uncertain',
]);
export type Confidence = z.infer<typeof confidenceSchema>;

const isoDateTime = z.string().datetime();
const nullableIsoDateTime = isoDateTime.nullable();

export const EvidenceSchema = z.object({
  id: z.string().min(1),
  claim: z.string().min(1).max(2000),
  subject: z.string().min(1),
  evidenceType: evidenceTypeSchema,
  eventAt: nullableIsoDateTime,
  observedAt: isoDateTime,
  market: marketSchema,
  confidence: confidenceSchema,
  sourceRefs: z.array(z.string().min(1)).min(1),
  metadata: z.record(z.string(), z.unknown()).optional(),
});
export type Evidence = z.infer<typeof EvidenceSchema>;

// Re-export Market here so the Evidence module is self-contained
// for importers that only need Evidence + its related primitives.
export type { Market };
