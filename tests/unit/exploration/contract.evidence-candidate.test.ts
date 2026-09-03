import { describe, it, expect } from 'vitest';
import {
  evidenceCandidateSchema,
  candidateSourceSchema,
} from '../../../exploration/contracts/evidence-candidate.js';

// Unit tests for the EvidenceCandidate + CandidateSource contracts.
//
// P0002 §4 / §6: an Evidence Candidate is the closest-shape-to-P0001
// representation of an atomic fact the agent is proposing. The
// candidate carries its source inline so the agent can produce
// provenance per fact rather than managing a separate index.

const VALID_SOURCE = {
  url: 'https://www.reuters.com/article/wonderful-2026',
  publisher: 'Reuters',
  title: 'Wonderful Series C announcement',
  publishedAt: '2026-09-02T10:00:00.000Z',
  accessedAt: '2026-09-03T01:23:45.000Z',
  sourceType: 'news',
  language: 'en',
};

describe('CandidateSource contract', () => {
  it('parses a valid source with all fields', () => {
    const result = candidateSourceSchema.safeParse(VALID_SOURCE);
    expect(result.success).toBe(true);
  });

  it('accepts any string url (URL validation is the bridge job, not the agent-output schema)', () => {
    const result = candidateSourceSchema.safeParse({ ...VALID_SOURCE, url: 'not a url' });
    expect(result.success).toBe(true);
  });

  it('accepts an empty url (bridge provenance gate catches this and rejects the candidate)', () => {
    const result = candidateSourceSchema.safeParse({ ...VALID_SOURCE, url: '' });
    expect(result.success).toBe(true);
  });

  it('rejects an empty publisher', () => {
    const result = candidateSourceSchema.safeParse({ ...VALID_SOURCE, publisher: '' });
    expect(result.success).toBe(false);
  });

  it('rejects an empty title', () => {
    const result = candidateSourceSchema.safeParse({ ...VALID_SOURCE, title: '' });
    expect(result.success).toBe(false);
  });

  it('rejects a non-ISO publishedAt', () => {
    const result = candidateSourceSchema.safeParse({ ...VALID_SOURCE, publishedAt: 'yesterday' });
    expect(result.success).toBe(false);
  });

  it('accepts a null publishedAt (some sources have no public timestamp)', () => {
    const result = candidateSourceSchema.safeParse({ ...VALID_SOURCE, publishedAt: null });
    expect(result.success).toBe(true);
  });

  it('rejects a non-ISO accessedAt', () => {
    const result = candidateSourceSchema.safeParse({ ...VALID_SOURCE, accessedAt: 'now' });
    expect(result.success).toBe(false);
  });

  it('rejects an unknown sourceType', () => {
    const result = candidateSourceSchema.safeParse({ ...VALID_SOURCE, sourceType: 'rumor' });
    expect(result.success).toBe(false);
  });

  it('rejects an unknown language', () => {
    const result = candidateSourceSchema.safeParse({ ...VALID_SOURCE, language: 'klingon' });
    expect(result.success).toBe(false);
  });

  it('accepts every P0001 sourceType', () => {
    const types = [
      'news', 'company_announcement', 'government', 'financial_report',
      'product_page', 'repository', 'marketplace', 'research', 'other',
    ];
    for (const t of types) {
      const result = candidateSourceSchema.safeParse({ ...VALID_SOURCE, sourceType: t });
      expect(result.success, `sourceType ${t} rejected`).toBe(true);
    }
  });

  it('accepts both P0001 languages (en, zh)', () => {
    for (const l of ['en', 'zh']) {
      const result = candidateSourceSchema.safeParse({ ...VALID_SOURCE, language: l });
      expect(result.success, `language ${l} rejected`).toBe(true);
    }
  });
});

describe('EvidenceCandidate contract', () => {
  const VALID_CANDIDATE = {
    claim: 'Wonderful raised USD 550M in a Series C financing round.',
    subject: 'Wonderful',
    evidenceType: 'funding',
    eventAt: '2026-08-30T00:00:00.000Z',
    market: 'US',
    source: VALID_SOURCE,
  };

  it('parses a valid candidate with all fields', () => {
    const result = evidenceCandidateSchema.safeParse(VALID_CANDIDATE);
    expect(result.success).toBe(true);
  });

  it('parses a valid candidate with null eventAt', () => {
    const result = evidenceCandidateSchema.safeParse({ ...VALID_CANDIDATE, eventAt: null });
    expect(result.success).toBe(true);
  });

  it('rejects an empty claim', () => {
    const result = evidenceCandidateSchema.safeParse({ ...VALID_CANDIDATE, claim: '' });
    expect(result.success).toBe(false);
  });

  it('rejects a claim longer than 2000 chars', () => {
    const result = evidenceCandidateSchema.safeParse({ ...VALID_CANDIDATE, claim: 'x'.repeat(2001) });
    expect(result.success).toBe(false);
  });

  it('rejects an empty subject', () => {
    const result = evidenceCandidateSchema.safeParse({ ...VALID_CANDIDATE, subject: '' });
    expect(result.success).toBe(false);
  });

  it('rejects an unknown evidenceType', () => {
    const result = evidenceCandidateSchema.safeParse({ ...VALID_CANDIDATE, evidenceType: 'hunch' });
    expect(result.success).toBe(false);
  });

  it('rejects an unknown market', () => {
    const result = evidenceCandidateSchema.safeParse({ ...VALID_CANDIDATE, market: 'PL' });
    expect(result.success).toBe(false);
  });

  it('rejects a candidate whose source is invalid (e.g. empty publisher — the whole thing is rejected)', () => {
    const result = evidenceCandidateSchema.safeParse({
      ...VALID_CANDIDATE,
      source: { ...VALID_SOURCE, publisher: '' },
    });
    expect(result.success).toBe(false);
  });

  it('accepts every P0001 evidenceType', () => {
    const types = [
      'funding', 'valuation', 'revenue', 'growth', 'customer_adoption',
      'product_launch', 'acquisition', 'policy', 'technology_capability',
      'market_activity', 'usage',
    ];
    for (const t of types) {
      const result = evidenceCandidateSchema.safeParse({ ...VALID_CANDIDATE, evidenceType: t });
      expect(result.success, `evidenceType ${t} rejected`).toBe(true);
    }
  });

  it('accepts every P0001 market', () => {
    for (const m of ['CN', 'US', 'GLOBAL', 'OTHER']) {
      const result = evidenceCandidateSchema.safeParse({ ...VALID_CANDIDATE, market: m });
      expect(result.success, `market ${m} rejected`).toBe(true);
    }
  });
});
