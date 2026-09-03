import { z } from 'zod';

// SourceDocument contract.
//
// A SourceDocument is the *external material* that carries an
// Evidence claim. It is NOT an Evidence itself. A single source
// can carry multiple atomic Evidence records; a single Evidence
// can be supported by multiple sources (corroboration).
//
// Per P0001 §SourceDocument and §Source vs Evidence Model.

export const sourceTypeSchema = z.enum([
  'news',
  'company_announcement',
  'government',
  'financial_report',
  'product_page',
  'repository',
  'marketplace',
  'research',
  'other',
]);
export type SourceType = z.infer<typeof sourceTypeSchema>;

export const languageSchema = z.enum(['en', 'zh']);
export type Language = z.infer<typeof languageSchema>;

export const marketSchema = z.enum(['CN', 'US', 'GLOBAL', 'OTHER']);
export type Market = z.infer<typeof marketSchema>;

// ISO 8601 datetime string, or null when the time is genuinely
// unknown. We use z.string().datetime() which validates the subset
// of ISO 8601 that includes a time component; the contract does
// not yet accept pure dates. Promote later if a use case appears.
const isoDateTime = z.string().datetime();
const nullableIsoDateTime = isoDateTime.nullable();

export const SourceDocumentSchema = z.object({
  id: z.string().min(1),
  sourceType: sourceTypeSchema,
  publisher: z.string().min(1),
  title: z.string().min(1),
  canonicalUrl: z.string().url(),
  publishedAt: nullableIsoDateTime,
  accessedAt: nullableIsoDateTime,
  language: languageSchema,
  market: marketSchema,
});
export type SourceDocument = z.infer<typeof SourceDocumentSchema>;
