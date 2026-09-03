import { describe, it, expect } from 'vitest';
import { HermesRuntimeAdapter, createHermesAdapter } from '../../../../runtime/hermes/adapter.js';
import type { HermesClient } from '../../../../runtime/hermes/types.js';
import type { HermesOneShotRequest, HermesOneShotResult } from '../../../../runtime/hermes/types.js';
import type { ExplorationGoal } from '../../../../exploration/contracts/exploration-goal.js';
import type { ExplorationResult } from '../../../../exploration/contracts/exploration-result.js';

// Unit tests for the Hermes concrete adapter. The adapter is
// the seam between Radar's neutral Goal/Result contract and
// Hermes's one-shot CLI. The tests use a recording stub client
// so the adapter is exercised end-to-end without spawning a
// real Hermes process.

class RecordingHermesClient implements HermesClient {
  isAvailable(): boolean {
    return true;
  }
  received: HermesOneShotRequest[] = [];
  nextResult: HermesOneShotResult;

  constructor(nextResult: HermesOneShotResult) {
    this.nextResult = nextResult;
  }

  async oneShot(req: HermesOneShotRequest): Promise<HermesOneShotResult> {
    this.received.push(req);
    return this.nextResult;
  }
}

const FIXED_NOW = (): Date => new Date('2026-09-03T02:00:00.000Z');

const GOAL: ExplorationGoal = {
  id: 'goal-adapter-1',
  question: 'q',
  market: 'US',
  createdAt: '2026-09-03T10:00:00.000Z',
};

const hermesStdout = (payload: unknown): string => {
  // Hermes writes prose, then a JSON object on the last line.
  return `stub prose\n${JSON.stringify(payload)}`;
};

describe('HermesRuntimeAdapter', () => {
  it('has runtimeId === "hermes"', () => {
    const client = new RecordingHermesClient({ stdout: hermesStdout({ summary: 's', sources: [], evidenceCandidates: [] }), exitCode: 0, durationMs: 1 });
    const adapter = new HermesRuntimeAdapter(client, { now: FIXED_NOW });
    expect(adapter.runtimeId).toBe('hermes');
  });

  it('builds a prompt from the goal, calls oneShot, parses stdout into a Result', async () => {
    const client = new RecordingHermesClient({
      stdout: hermesStdout({
        summary: 'found one fact',
        sources: [
          {
            url: 'https://www.reuters.com/article/a',
            publisher: 'Reuters',
            title: 'A',
            publishedAt: '2026-09-02T10:00:00.000Z',
            accessedAt: '2026-09-03T01:00:00.000Z',
            sourceType: 'news',
            language: 'en',
          },
        ],
        evidenceCandidates: [
          {
            claim: 'Wonderful raised USD 550M.',
            subject: 'Wonderful',
            evidenceType: 'funding',
            eventAt: '2026-08-30T00:00:00.000Z',
            market: 'US',
            source: {
              url: 'https://www.reuters.com/article/a',
              publisher: 'Reuters',
              title: 'A',
              publishedAt: '2026-09-02T10:00:00.000Z',
              accessedAt: '2026-09-03T01:00:00.000Z',
              sourceType: 'news',
              language: 'en',
            },
          },
        ],
      }),
      exitCode: 0,
      durationMs: 42,
    });
    const adapter = new HermesRuntimeAdapter(client, { now: FIXED_NOW });

    const result: ExplorationResult = await adapter.execute(GOAL);

    // The adapter actually called the client
    expect(client.received).toHaveLength(1);
    expect(client.received[0]?.prompt).toContain('Question: q');
    expect(client.received[0]?.prompt).toContain('Market: US');
    expect(client.received[0]?.safeMode).toBe(true);

    // The adapter returned a Zod-valid Result bound to the goal
    expect(result.goalId).toBe(GOAL.id);
    expect(result.summary).toBe('found one fact');
    expect(result.evidenceCandidates).toHaveLength(1);
    expect(result.evidenceCandidates[0]?.claim).toBe('Wonderful raised USD 550M.');
    expect(result.exploredAt).toBe('2026-09-03T02:00:00.000Z');
  });

  it('throws when the goal fails Zod re-validation at the adapter boundary', async () => {
    const client = new RecordingHermesClient({
      stdout: hermesStdout({ summary: 's', sources: [], evidenceCandidates: [] }),
      exitCode: 0,
      durationMs: 1,
    });
    const adapter = new HermesRuntimeAdapter(client, { now: FIXED_NOW });

    // Pass a structurally invalid goal (missing id)
    await expect(adapter.execute({ question: 'q', market: 'US', createdAt: '2026-09-03T10:00:00.000Z' } as unknown as ExplorationGoal)).rejects.toThrowError(
      /invalid ExplorationGoal/,
    );
    expect(client.received).toHaveLength(0);
  });

  it('throws when Hermes returns a malformed Result (parse failure)', async () => {
    const client = new RecordingHermesClient({
      stdout: 'hermes said something but no JSON at all',
      exitCode: 0,
      durationMs: 1,
    });
    const adapter = new HermesRuntimeAdapter(client, { now: FIXED_NOW });
    await expect(adapter.execute(GOAL)).rejects.toThrowError(/no parseable JSON/);
  });

  it('throws when the client itself throws (e.g. hermes not installed)', async () => {
    const failingClient: HermesClient = {
      isAvailable: (): boolean => false,
      oneShot: (): Promise<HermesOneShotResult> => Promise.reject(new Error('hermes: binary not found')),
    };
    const adapter = new HermesRuntimeAdapter(failingClient, { now: FIXED_NOW });
    await expect(adapter.execute(GOAL)).rejects.toThrowError(/hermes: binary not found/);
  });
});

describe('createHermesAdapter', () => {
  it('returns an adapter with runtimeId === "hermes" regardless of the underlying client', () => {
    const client = new RecordingHermesClient({
      stdout: hermesStdout({ summary: 's', sources: [], evidenceCandidates: [] }),
      exitCode: 0,
      durationMs: 1,
    });
    const adapter = createHermesAdapter({ client });
    expect(adapter.runtimeId).toBe('hermes');
  });
});
