import { z } from 'zod';
import { marketSchema } from '../../evidence/contracts/source-document.js';
import { evidenceTypeSchema } from '../../evidence/contracts/evidence.js';

// EvidenceCandidate + CandidateSource — what an external Agent
// capability returns per fact. P0002 §4 / §6 / ADR-015.
//
// An EvidenceCandidate is the closest-shape-to-P0001 representation
// of an atomic fact the external Agent is proposing. The candidate
// carries its source inline so the Agent can produce provenance
// per fact rather than managing a separate index. This is
// "untrusted Agent output" — every field is Zod-validated at the
// boundary before Radar writes it to the Evidence Store.
//
// Per ADR-015 this contract is Agent-neutral: it does not name
// any Agent Runtime, transport, session, credential, model, or
// tool.

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

export const languageSchema = z.enum(['en', 'zh']);

export const candidateSourceSchema = z.object({
  url: z.string(),
  publisher: z.string().min(1),
  title: z.string().min(1),
  publishedAt: z.string().datetime().nullable(),
  accessedAt: z.string().datetime(),
  sourceType: sourceTypeSchema,
  language: languageSchema,
});

export const evidenceCandidateSchema = z.object({
  claim: z.string().min(1).max(2000),
  subject: z.string().min(1),
  evidenceType: evidenceTypeSchema,
  eventAt: z.string().datetime().nullable(),
  market: marketSchema,
  source: candidateSourceSchema,
});

export type CandidateSource = z.infer<typeof candidateSourceSchema>;
export type EvidenceCandidate = z.infer<typeof evidenceCandidateSchema>;
