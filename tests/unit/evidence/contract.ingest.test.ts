import { describe, it, expect } from 'vitest';
import { IngestPayloadSchema } from '../../../evidence/contracts/ingest.js';

// Contract tests for the Manual Ingest payload.
//
// The Ingest Payload encodes "1 source → N evidence" — one Source
// Document, one or more atomic Evidence records citing it. Per
// P0001 §Manual Ingest Contract. A well-formed payload can be handed
// to the EvidenceRepository.ingest operation.

describe('IngestPayload contract', () => {
  const validSource = {
    id: 'src-reuters-wonderful-20260902',
    sourceType: 'news' as const,
    publisher: 'Reuters',
    title: 'Wonderful raises USD 550M Series C',
    canonicalUrl: 'https://www.reuters.com/article/wonderful-series-c-2026',
    publishedAt: '2026-09-02T10:00:00.000Z',
    accessedAt: '2026-09-03T01:23:45.000Z',
    language: 'en' as const,
    market: 'US' as const,
  };

  const validEvidence = {
    id: 'ev-wonderful-2026-series-c',
    claim: 'Wonderful raised USD 550M in a Series C financing round.',
    subject: 'Wonderful',
    evidenceType: 'funding' as const,
    eventAt: '2026-08-30T00:00:00.000Z',
    observedAt: '2026-09-03T01:23:45.000Z',
    market: 'US' as const,
    confidence: 'reported' as const,
    sourceRefs: ['src-reuters-wonderful-20260902'],
  };

  it('accepts a payload with one source and one evidence', () => {
    const result = IngestPayloadSchema.safeParse({
      source: validSource,
      evidence: [validEvidence],
    });
    expect(result.success).toBe(true);
  });

  it('accepts a payload with one source and multiple evidence', () => {
    const result = IngestPayloadSchema.safeParse({
      source: validSource,
      evidence: [
        validEvidence,
        {
          ...validEvidence,
          id: 'ev-wonderful-2026-valuation',
          claim: 'Wonderful reached a USD 5B reported valuation.',
          evidenceType: 'valuation',
        },
        {
          ...validEvidence,
          id: 'ev-wonderful-2026-customers',
          claim: 'Wonderful reported approximately 100 enterprise customers.',
          evidenceType: 'customer_adoption',
        },
      ],
    });
    expect(result.success).toBe(true);
  });

  it('rejects a payload with no evidence (empty array)', () => {
    const result = IngestPayloadSchema.safeParse({
      source: validSource,
      evidence: [],
    });
    expect(result.success).toBe(false);
  });

  it('rejects a payload with malformed source (the whole payload is invalid)', () => {
    const result = IngestPayloadSchema.safeParse({
      source: { ...validSource, canonicalUrl: 'not a url' },
      evidence: [validEvidence],
    });
    expect(result.success).toBe(false);
  });

  it('rejects a payload with malformed evidence', () => {
    const result = IngestPayloadSchema.safeParse({
      source: validSource,
      evidence: [{ ...validEvidence, claim: '' }],
    });
    expect(result.success).toBe(false);
  });

  it('rejects a payload missing the source field', () => {
    const result = IngestPayloadSchema.safeParse({
      evidence: [validEvidence],
    });
    expect(result.success).toBe(false);
  });
});
