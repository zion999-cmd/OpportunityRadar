import { z } from 'zod';
import { SourceDocumentSchema } from './source-document.js';
import { EvidenceSchema } from './evidence.js';

// Manual Ingest Payload contract.
//
// The Ingest payload is the *only* way external material enters the
// Evidence Store during P0001. Each payload encodes the natural
// "1 source → N evidence" relationship: a single Source Document
// is decomposed into one or more atomic Evidence records that
// cite it.
//
// Per P0001 §Manual Ingest Contract and §Ingest Transaction.

export const IngestPayloadSchema = z.object({
  source: SourceDocumentSchema,
  evidence: z.array(EvidenceSchema).min(1),
});
export type IngestPayload = z.infer<typeof IngestPayloadSchema>;
