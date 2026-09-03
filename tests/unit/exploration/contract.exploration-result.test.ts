import { describe, it, expect } from 'vitest';
import { explorationResultSchema } from '../../../exploration/contracts/exploration-result.js';

// Unit tests for the ExplorationResult contract.
//
// P0002 §3: an external Agent capability returns a structured
// result, not a market analysis. The result binds back to the
// goal, carries a human-readable summary, the dedup'd set of
// sources the Agent discovered, and the candidate evidence
// list.

const SOURCE_A = {
  url: 'https://www.reuters.com/article/a',
  publisher: 'Reuters',
  title: 'A',
  publishedAt: '2026-09-02T10:00:00.000Z',
  accessedAt: '2026-09-03T01:00:00.000Z',
  sourceType: 'news',
  language: 'en',
};

const SOURCE_B = {
  url: 'https://www.bloomberg.com/news/b',
  publisher: 'Bloomberg',
  title: 'B',
  publishedAt: '2026-09-01T13:00:00.000Z',
  accessedAt: '2026-09-03T01:00:00.000Z',
  sourceType: 'news',
  language: 'en',
};

const CANDIDATE_FUNDING = {
  claim: 'Wonderful raised USD 550M in a Series C.',
  subject: 'Wonderful',
  evidenceType: 'funding',
  eventAt: '2026-08-30T00:00:00.000Z',
  market: 'US',
  source: SOURCE_A,
};

const CANDIDATE_VALUATION = {
  claim: 'Wonderful post-money valuation reached USD 5B.',
  subject: 'Wonderful',
  evidenceType: 'valuation',
  eventAt: '2026-08-30T00:00:00.000Z',
  market: 'US',
  source: SOURCE_B,
};

describe('ExplorationResult contract', () => {
  it('parses a valid result with multiple candidates from distinct sources', () => {
    const input = {
      goalId: 'goal-001',
      summary: 'Wonderful raised a Series C; multiple sources confirm.',
      sources: [SOURCE_A, SOURCE_B],
      evidenceCandidates: [CANDIDATE_FUNDING, CANDIDATE_VALUATION],
      exploredAt: '2026-09-03T01:30:00.000Z',
    };
    const result = explorationResultSchema.safeParse(input);
    expect(result.success).toBe(true);
  });

  it('parses a valid result with zero candidates (Agent found nothing)', () => {
    const input = {
      goalId: 'goal-001',
      summary: 'No signal found in the requested window.',
      sources: [],
      evidenceCandidates: [],
      exploredAt: '2026-09-03T01:30:00.000Z',
    };
    const result = explorationResultSchema.safeParse(input);
    expect(result.success).toBe(true);
  });

  it('rejects an empty goalId', () => {
    const result = explorationResultSchema.safeParse({
      goalId: '',
      summary: 's',
      sources: [],
      evidenceCandidates: [],
      exploredAt: '2026-09-03T01:30:00.000Z',
    });
    expect(result.success).toBe(false);
  });

  it('rejects a non-ISO exploredAt', () => {
    const result = explorationResultSchema.safeParse({
      goalId: 'goal-001',
      summary: 's',
      sources: [],
      evidenceCandidates: [],
      exploredAt: '2026-09-03',
    });
    expect(result.success).toBe(false);
  });

  it('rejects the whole result if any candidate is invalid', () => {
    const input = {
      goalId: 'goal-001',
      summary: 's',
      sources: [SOURCE_A],
      evidenceCandidates: [
        CANDIDATE_FUNDING,
        { ...CANDIDATE_VALUATION, claim: '' }, // invalid
      ],
      exploredAt: '2026-09-03T01:30:00.000Z',
    };
    const result = explorationResultSchema.safeParse(input);
    expect(result.success).toBe(false);
  });

  it('accepts a result with a non-URL source entry (URL validation is the bridge job)', () => {
    const input = {
      goalId: 'goal-001',
      summary: 's',
      sources: [SOURCE_A, { ...SOURCE_B, url: 'not a url' }],
      evidenceCandidates: [CANDIDATE_FUNDING],
      exploredAt: '2026-09-03T01:30:00.000Z',
    };
    const result = explorationResultSchema.safeParse(input);
    expect(result.success).toBe(true);
  });

  it('allows candidates to share a source across multiple facts', () => {
    // The same source underwriting two facts in the same result.
    const input = {
      goalId: 'goal-001',
      summary: 's',
      sources: [SOURCE_A],
      evidenceCandidates: [
        CANDIDATE_FUNDING,
        { ...CANDIDATE_FUNDING, evidenceType: 'valuation', claim: 'Wonderful valued at $5B.' },
      ],
      exploredAt: '2026-09-03T01:30:00.000Z',
    };
    const result = explorationResultSchema.safeParse(input);
    expect(result.success).toBe(true);
  });
});
