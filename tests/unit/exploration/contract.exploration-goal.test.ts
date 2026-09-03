import { describe, it, expect } from 'vitest';
import { explorationGoalSchema } from '../../../exploration/contracts/exploration-goal.js';

// Unit tests for the ExplorationGoal contract.
//
// P0002 §1: ExplorationGoal is the smallest business object Radar
// hands to an external Agent capability. It carries the
// question, the market context, an optional time window,
// optional evidence-type hints, and a generated id + createdAt
// timestamp.

describe('ExplorationGoal contract', () => {
  it('parses a valid goal with all fields populated', () => {
    // Arrange
    const input = {
      id: 'goal-001',
      question: 'What AI funding rounds were announced in the US last 30 days?',
      market: 'US',
      timeWindow: 'last_30_days',
      evidenceInterests: ['funding', 'acquisition'],
      createdAt: '2026-09-03T10:00:00.000Z',
    };

    // Act
    const result = explorationGoalSchema.safeParse(input);

    // Assert
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.id).toBe('goal-001');
      expect(result.data.market).toBe('US');
      expect(result.data.evidenceInterests).toEqual(['funding', 'acquisition']);
    }
  });

  it('parses a valid goal with only required fields (timeWindow + evidenceInterests optional)', () => {
    const input = {
      id: 'goal-002',
      question: 'What is happening in CN embodied AI?',
      market: 'CN',
      createdAt: '2026-09-03T10:00:00.000Z',
    };
    const result = explorationGoalSchema.safeParse(input);
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.timeWindow).toBeUndefined();
      expect(result.data.evidenceInterests).toBeUndefined();
    }
  });

  it('rejects an empty id', () => {
    const input = {
      id: '',
      question: 'q',
      market: 'US',
      createdAt: '2026-09-03T10:00:00.000Z',
    };
    const result = explorationGoalSchema.safeParse(input);
    expect(result.success).toBe(false);
  });

  it('rejects an empty question', () => {
    const input = {
      id: 'goal-1',
      question: '',
      market: 'US',
      createdAt: '2026-09-03T10:00:00.000Z',
    };
    const result = explorationGoalSchema.safeParse(input);
    expect(result.success).toBe(false);
  });

  it('rejects a question longer than 2000 chars', () => {
    const input = {
      id: 'goal-1',
      question: 'q'.repeat(2001),
      market: 'US',
      createdAt: '2026-09-03T10:00:00.000Z',
    };
    const result = explorationGoalSchema.safeParse(input);
    expect(result.success).toBe(false);
  });

  it('rejects an unknown market', () => {
    const input = {
      id: 'goal-1',
      question: 'q',
      market: 'WONDERLAND',
      createdAt: '2026-09-03T10:00:00.000Z',
    };
    const result = explorationGoalSchema.safeParse(input);
    expect(result.success).toBe(false);
  });

  it('rejects an empty timeWindow string', () => {
    const input = {
      id: 'goal-1',
      question: 'q',
      market: 'US',
      timeWindow: '',
      createdAt: '2026-09-03T10:00:00.000Z',
    };
    const result = explorationGoalSchema.safeParse(input);
    expect(result.success).toBe(false);
  });

  it('rejects an evidenceInterest that is not in the P0001 evidenceType enum', () => {
    const input = {
      id: 'goal-1',
      question: 'q',
      market: 'US',
      evidenceInterests: ['not_a_real_evidence_type'],
      createdAt: '2026-09-03T10:00:00.000Z',
    };
    const result = explorationGoalSchema.safeParse(input);
    expect(result.success).toBe(false);
  });

  it('rejects a non-ISO createdAt', () => {
    const input = {
      id: 'goal-1',
      question: 'q',
      market: 'US',
      createdAt: '2026-09-03 10:00:00',
    };
    const result = explorationGoalSchema.safeParse(input);
    expect(result.success).toBe(false);
  });

  it('accepts every value of the P0001 evidenceType enum in evidenceInterests', () => {
    const all = [
      'funding', 'valuation', 'revenue', 'growth', 'customer_adoption',
      'product_launch', 'acquisition', 'policy', 'technology_capability',
      'market_activity', 'usage',
    ];
    const input = {
      id: 'goal-1',
      question: 'q',
      market: 'GLOBAL',
      evidenceInterests: all,
      createdAt: '2026-09-03T10:00:00.000Z',
    };
    const result = explorationGoalSchema.safeParse(input);
    expect(result.success).toBe(true);
  });
});
