import { describe, it, expect } from 'vitest';
import { CROSS_DOMAIN_CASES } from '../../../semantic-completion/cross-domain-cases.js';

describe('CROSS_DOMAIN_CASES', () => {
  it('contains exactly 3 cases', () => {
    expect(CROSS_DOMAIN_CASES).toHaveLength(3);
  });

  it('every case has a caseId, non-empty rawA, rawB, and title', () => {
    for (const c of CROSS_DOMAIN_CASES) {
      expect(c.caseId).toBeDefined();
      expect((c.caseId ?? '').length).toBeGreaterThan(0);
      expect(c.rawA.length).toBeGreaterThan(0);
      expect(c.rawB.length).toBeGreaterThan(0);
      expect(c.title.length).toBeGreaterThan(0);
    }
  });

  it('caseIds are unique across the 3 cases', () => {
    const ids = CROSS_DOMAIN_CASES.map((c) => c.caseId);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it('contains the expected 3 caseIds in the expected order', () => {
    const ids = CROSS_DOMAIN_CASES.map((c) => c.caseId);
    expect(ids).toEqual([
      'manufacturing-to-fulfillment',
      'restaurant-to-support',
      'event-production-to-release',
    ]);
  });

  it('Raw A and Raw B of each case differ (no two cases accidentally share materials)', () => {
    const allA = CROSS_DOMAIN_CASES.map((c) => c.rawA);
    const allB = CROSS_DOMAIN_CASES.map((c) => c.rawB);
    expect(new Set(allA).size).toBe(allA.length);
    expect(new Set(allB).size).toBe(allB.length);
  });

  it('Raw A of each case does not start with Raw B of any other case (smoke check for accidental cross-contamination)', () => {
    for (let i = 0; i < CROSS_DOMAIN_CASES.length; i += 1) {
      const aHead = CROSS_DOMAIN_CASES[i]!.rawA.slice(0, 60);
      for (let j = 0; j < CROSS_DOMAIN_CASES.length; j += 1) {
        if (i === j) continue;
        expect(CROSS_DOMAIN_CASES[j]!.rawB.startsWith(aHead)).toBe(false);
      }
    }
  });
});
