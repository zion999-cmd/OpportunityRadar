// Barrel for the Evidence Contracts module.
//
// Per CLAUDE.md §4.4 ("Business Concepts Over Technical Abstractions"),
// these contracts live under evidence/contracts/ — a Radar business
// concept — not under shared/schemas/, which is reserved for
// framework-free generic types.

export {
  SourceDocumentSchema,
  sourceTypeSchema,
  languageSchema,
  marketSchema,
} from './source-document.js';
export type {
  SourceDocument,
  SourceType,
  Language,
  Market,
} from './source-document.js';

export {
  EvidenceSchema,
  evidenceTypeSchema,
  confidenceSchema,
} from './evidence.js';
export type {
  Evidence,
  EvidenceType,
  Confidence,
} from './evidence.js';

export { IngestPayloadSchema } from './ingest.js';
export type { IngestPayload } from './ingest.js';
