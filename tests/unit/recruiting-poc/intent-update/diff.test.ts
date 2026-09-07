import { describe, it, expect } from 'vitest';
import { computeRelationshipSpaceDiff } from '../../../../matching/recruiting-poc/intent-update/diff.js';
import type { FullPoolDiscoveredRelationship } from '../../../../matching/recruiting-poc/parse.js';

function rel(
  candidateId: string,
  judgment: 'worth_exploring' | 'uncertain',
): FullPoolDiscoveredRelationship {
  return {
    candidateId,
    judgment,
    analysis: `analysis for ${candidateId}`,
    evidence: [],
    unknowns: [],
    nextStep: `next step for ${candidateId}`,
  };
}

describe('recruiting-poc/intent-update/diff — deterministic set operations', () => {
  it('returns empty diffs when all three sets are equal', () => {
    const baseline = [rel('C01', 'worth_exploring'), rel('C02', 'uncertain')];
    const a = [rel('C01', 'worth_exploring'), rel('C02', 'uncertain')];
    const b = [rel('C01', 'worth_exploring'), rel('C02', 'uncertain')];
    const diff = computeRelationshipSpaceDiff(baseline, a, b);
    expect(diff.surfacedInBaseline).toEqual(['C01', 'C02']);
    expect(diff.surfacedInA).toEqual(['C01', 'C02']);
    expect(diff.surfacedInB).toEqual(['C01', 'C02']);
    expect(diff.addedInA).toEqual([]);
    expect(diff.removedInA).toEqual([]);
    expect(diff.addedInB).toEqual([]);
    expect(diff.removedInB).toEqual([]);
    expect(diff.judgmentChangedInA).toEqual([]);
    expect(diff.judgmentChangedInB).toEqual([]);
  });

  it('detects added and removed candidates in Run A', () => {
    const baseline = [rel('C01', 'worth_exploring'), rel('C02', 'uncertain')];
    const a = [rel('C01', 'worth_exploring'), rel('C03', 'worth_exploring')];
    const b = baseline;
    const diff = computeRelationshipSpaceDiff(baseline, a, b);
    expect(diff.addedInA).toEqual(['C03']);
    expect(diff.removedInA).toEqual(['C02']);
    expect(diff.addedInB).toEqual([]);
    expect(diff.removedInB).toEqual([]);
  });

  it('detects added and removed candidates in Run B', () => {
    const baseline = [rel('C01', 'worth_exploring'), rel('C02', 'uncertain')];
    const a = baseline;
    const b = [rel('C02', 'uncertain'), rel('C07', 'worth_exploring')];
    const diff = computeRelationshipSpaceDiff(baseline, a, b);
    expect(diff.addedInB).toEqual(['C07']);
    expect(diff.removedInB).toEqual(['C01']);
    expect(diff.addedInA).toEqual([]);
    expect(diff.removedInA).toEqual([]);
  });

  it('detects judgment changes (worth_exploring ↔ uncertain) for shared members', () => {
    const baseline = [rel('C01', 'worth_exploring'), rel('C02', 'uncertain')];
    const a = [rel('C01', 'worth_exploring'), rel('C02', 'worth_exploring')];
    const b = [rel('C01', 'uncertain'), rel('C02', 'uncertain')];
    const diff = computeRelationshipSpaceDiff(baseline, a, b);
    expect(diff.judgmentChangedInA).toEqual(['C02']);
    expect(diff.judgmentChangedInB).toEqual(['C01']);
  });

  it('does NOT report a membership change as a judgment change', () => {
    // C03 is added in Run A. It is NOT in the baseline, so
    // its judgment cannot be a "change" — there is no prior
    // judgment to compare against.
    const baseline = [rel('C01', 'worth_exploring')];
    const a = [rel('C01', 'worth_exploring'), rel('C03', 'worth_exploring')];
    const b = baseline;
    const diff = computeRelationshipSpaceDiff(baseline, a, b);
    expect(diff.judgmentChangedInA).toEqual([]);
    expect(diff.addedInA).toEqual(['C03']);
  });

  it('returns all surfaced IDs sorted', () => {
    const baseline = [rel('C09', 'worth_exploring'), rel('C01', 'worth_exploring'), rel('C03', 'worth_exploring')];
    const a = [rel('C03', 'worth_exploring'), rel('C09', 'worth_exploring'), rel('C01', 'worth_exploring')];
    const b = a;
    const diff = computeRelationshipSpaceDiff(baseline, a, b);
    expect(diff.surfacedInBaseline).toEqual(['C01', 'C03', 'C09']);
    expect(diff.surfacedInA).toEqual(['C01', 'C03', 'C09']);
    expect(diff.surfacedInB).toEqual(['C01', 'C03', 'C09']);
  });

  it('handles empty baseline', () => {
    const diff = computeRelationshipSpaceDiff([], [rel('C01', 'worth_exploring')], []);
    expect(diff.surfacedInBaseline).toEqual([]);
    expect(diff.addedInA).toEqual(['C01']);
    expect(diff.removedInA).toEqual([]);
    expect(diff.judgmentChangedInA).toEqual([]);
  });

  it('handles both runs returning empty (no relationship surfaced)', () => {
    const diff = computeRelationshipSpaceDiff(
      [rel('C01', 'worth_exploring')],
      [],
      [],
    );
    expect(diff.surfacedInA).toEqual([]);
    expect(diff.surfacedInB).toEqual([]);
    expect(diff.removedInA).toEqual(['C01']);
    expect(diff.removedInB).toEqual(['C01']);
    expect(diff.addedInA).toEqual([]);
    expect(diff.addedInB).toEqual([]);
  });

  it('is deterministic across two invocations (same input → same output)', () => {
    const baseline = [rel('C01', 'worth_exploring'), rel('C07', 'uncertain')];
    const a = [rel('C01', 'worth_exploring'), rel('C09', 'worth_exploring')];
    const b = [rel('C07', 'worth_exploring'), rel('C09', 'worth_exploring')];
    const d1 = computeRelationshipSpaceDiff(baseline, a, b);
    const d2 = computeRelationshipSpaceDiff(baseline, a, b);
    expect(d1).toEqual(d2);
  });
});
