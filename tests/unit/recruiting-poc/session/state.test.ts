import { describe, it, expect } from 'vitest';
import {
  appendIntentEvidence,
  createInitialState,
  incrementAskCount,
  isBudgetExhausted,
  MAX_ASK_BUDGET,
  type SessionState,
} from '../../../../matching/recruiting-poc/session/state.js';

describe('recruiting-poc/session/state', () => {
  it('createInitialState preserves the raw situation verbatim', () => {
    const s = createInitialState('我现在的 Kafka 没人 owner。');
    expect(s.rawSituation).toBe('我现在的 Kafka 没人 owner。');
    expect(s.rawIntentEvidence).toEqual([]);
    expect(s.askCount).toBe(0);
  });

  it('appendIntentEvidence appends verbatim and does not mutate', () => {
    const initial = createInitialState('situation');
    const a1 = appendIntentEvidence(initial, 'first answer');
    const a2 = appendIntentEvidence(a1, 'second answer');
    // Original is unchanged.
    expect(initial.rawIntentEvidence).toEqual([]);
    expect(a1.rawIntentEvidence).toEqual(['first answer']);
    expect(a2.rawIntentEvidence).toEqual(['first answer', 'second answer']);
  });

  it('incrementAskCount is immutable and only touches askCount', () => {
    const initial = createInitialState('situation');
    const next = incrementAskCount(initial);
    expect(initial.askCount).toBe(0);
    expect(next.askCount).toBe(1);
    expect(next.rawSituation).toBe(initial.rawSituation);
    expect(next.rawIntentEvidence).toBe(initial.rawIntentEvidence);
  });

  it('MAX_ASK_BUDGET is exactly 2 (per Stage 0 §5)', () => {
    expect(MAX_ASK_BUDGET).toBe(2);
  });

  it('isBudgetExhausted is false at 0 and 1, true at 2 and 3', () => {
    const s0: SessionState = { ...createInitialState('x'), askCount: 0 };
    const s1 = incrementAskCount(s0);
    const s2 = incrementAskCount(s1);
    const s3 = incrementAskCount(s2);
    expect(isBudgetExhausted(s0)).toBe(false);
    expect(isBudgetExhausted(s1)).toBe(false);
    expect(isBudgetExhausted(s2)).toBe(true);
    expect(isBudgetExhausted(s3)).toBe(true);
  });

  it('the session state has no Job / Profile / requirements / skills / tags / filters / hardConstraints / preferences fields', () => {
    const s = createInitialState('x');
    const keys = Object.keys(s).sort();
    expect(keys).toEqual(['askCount', 'rawIntentEvidence', 'rawSituation']);
  });
});
