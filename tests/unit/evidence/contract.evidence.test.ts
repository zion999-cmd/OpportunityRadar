import { describe, it, expect } from 'vitest';
import {
  EvidenceSchema,
  evidenceTypeSchema,
  confidenceSchema,
} from '../../../evidence/contracts/evidence.js';
import { marketSchema } from '../../../evidence/contracts/source-document.js';

// Contract tests for Evidence. Per CLAUDE.md §3, every Evidence is an
// atomic, externally observable factual claim with traceable provenance.
// These tests pin the shape: claim / subject / evidenceType / eventAt /
// observedAt / market / confidence / sourceRefs / optional metadata.

describe('Evidence contract', () => {
  describe('evidenceType enum', () => {
    it('accepts the documented 11 evidence types', () => {
      const allowed = [
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
      ] as const;
      for (const value of allowed) {
        const result = evidenceTypeSchema.safeParse(value);
        expect(result.success).toBe(true);
      }
    });

    it('rejects an unknown evidenceType', () => {
      const result = evidenceTypeSchema.safeParse('vibes');
      expect(result.success).toBe(false);
    });
  });

  describe('confidence enum', () => {
    it('accepts the four documented confidence levels', () => {
      expect(confidenceSchema.safeParse('primary').success).toBe(true);
      expect(confidenceSchema.safeParse('corroborated').success).toBe(true);
      expect(confidenceSchema.safeParse('reported').success).toBe(true);
      expect(confidenceSchema.safeParse('uncertain').success).toBe(true);
    });

    it('rejects an unknown confidence', () => {
      const result = confidenceSchema.safeParse('guaranteed');
      expect(result.success).toBe(false);
    });
  });

  describe('market enum (reused from SourceDocument)', () => {
    it('accepts the four documented market values', () => {
      expect(marketSchema.safeParse('CN').success).toBe(true);
      expect(marketSchema.safeParse('US').success).toBe(true);
      expect(marketSchema.safeParse('GLOBAL').success).toBe(true);
      expect(marketSchema.safeParse('OTHER').success).toBe(true);
    });
  });

  describe('full Evidence payload', () => {
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

    it('accepts a complete, well-formed Evidence', () => {
      const result = EvidenceSchema.safeParse(validEvidence);
      expect(result.success).toBe(true);
    });

    it('accepts null eventAt (event time genuinely unknown)', () => {
      const result = EvidenceSchema.safeParse({
        ...validEvidence,
        eventAt: null,
      });
      expect(result.success).toBe(true);
    });

    it('rejects an empty claim', () => {
      const result = EvidenceSchema.safeParse({
        ...validEvidence,
        claim: '',
      });
      expect(result.success).toBe(false);
    });

    it('rejects an empty subject', () => {
      const result = EvidenceSchema.safeParse({
        ...validEvidence,
        subject: '',
      });
      expect(result.success).toBe(false);
    });

    it('rejects an empty sourceRefs array (no provenance)', () => {
      const result = EvidenceSchema.safeParse({
        ...validEvidence,
        sourceRefs: [],
      });
      expect(result.success).toBe(false);
    });

    it('rejects an unknown evidenceType', () => {
      const result = EvidenceSchema.safeParse({
        ...validEvidence,
        evidenceType: 'trend',
      });
      expect(result.success).toBe(false);
    });

    it('rejects an unknown confidence', () => {
      const result = EvidenceSchema.safeParse({
        ...validEvidence,
        confidence: 'verified',
      });
      expect(result.success).toBe(false);
    });

    it('rejects a malformed observedAt timestamp', () => {
      const result = EvidenceSchema.safeParse({
        ...validEvidence,
        observedAt: 'yesterday',
      });
      expect(result.success).toBe(false);
    });

    it('accepts optional metadata as a record', () => {
      const result = EvidenceSchema.safeParse({
        ...validEvidence,
        metadata: {
          currency: 'USD',
          amount: 550_000_000,
          round: 'Series C',
        },
      });
      expect(result.success).toBe(true);
    });

    it('accepts a missing metadata field', () => {
      const result = EvidenceSchema.safeParse(validEvidence);
      expect(result.success).toBe(true);
    });
  });
});
