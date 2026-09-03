import { describe, it, expect } from 'vitest';
import { DefaultExplorationRuntimeRouter } from '../../../runtime/types.js';
import type { RuntimeAdapter, ExplorationRuntimeRouter } from '../../../runtime/types.js';
import type { ExplorationGoal } from '../../../exploration/contracts/exploration-goal.js';
import type { ExplorationResult } from '../../../exploration/contracts/exploration-result.js';

// Unit tests for the Agent-neutral Runtime seam. The router must
// dispatch through whatever adapter it is constructed with, and
// nothing more. No registry, no preference, no selection logic —
// that comes later if a second adapter ever appears.

class StubAdapter implements RuntimeAdapter {
  readonly runtimeId = 'stub';
  nextResult: ExplorationResult | null = null;
  nextThrow: Error | null = null;
  receivedGoals: ExplorationGoal[] = [];

  async execute(goal: ExplorationGoal): Promise<ExplorationResult> {
    this.receivedGoals.push(goal);
    if (this.nextThrow !== null) {
      const err = this.nextThrow;
      this.nextThrow = null;
      throw err;
    }
    if (this.nextResult === null) {
      throw new Error('StubAdapter: nextResult not set');
    }
    const result = this.nextResult;
    this.nextResult = null;
    return result;
  }
}

const GOAL: ExplorationGoal = {
  id: 'goal-router-1',
  question: 'q',
  market: 'US',
  createdAt: '2026-09-03T10:00:00.000Z',
};

const RESULT: ExplorationResult = {
  goalId: 'goal-router-1',
  summary: 's',
  sources: [],
  evidenceCandidates: [],
  exploredAt: '2026-09-03T01:30:00.000Z',
};

describe('DefaultExplorationRuntimeRouter', () => {
  it('dispatches the goal to the wrapped adapter and returns its result', async () => {
    const adapter = new StubAdapter();
    adapter.nextResult = RESULT;
    const router: ExplorationRuntimeRouter = new DefaultExplorationRuntimeRouter(adapter);
    const out = await router.dispatch(GOAL);
    expect(out).toBe(RESULT);
    expect(adapter.receivedGoals).toEqual([GOAL]);
  });

  it('propagates adapter throws so the bridge can mark the run failed', async () => {
    const adapter = new StubAdapter();
    adapter.nextThrow = new Error('adapter: kaboom');
    const router = new DefaultExplorationRuntimeRouter(adapter);
    await expect(router.dispatch(GOAL)).rejects.toThrow('adapter: kaboom');
  });

  it('accepts an unused routerPreference (with one adapter, no selection happens)', async () => {
    const adapter = new StubAdapter();
    adapter.nextResult = RESULT;
    const router = new DefaultExplorationRuntimeRouter(adapter);
    const out = await router.dispatch(GOAL, 'whatever');
    expect(out).toBe(RESULT);
  });
});
