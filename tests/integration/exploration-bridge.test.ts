import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { openDatabase, type SqliteDatabase } from '../../storage/connection.js';
import { initSchema } from '../../storage/init.js';
import { ingest, list } from '../../evidence/repository/evidence-repository.js';
import {
  createExplorationBridge,
  InMemoryRunRecorder,
  type ExplorationBridge,
} from '../../exploration/bridge/exploration-bridge.js';
import type { ExplorationGoal } from '../../exploration/contracts/exploration-goal.js';
import type { ExplorationResult } from '../../exploration/contracts/exploration-result.js';
import {
  DefaultExplorationRuntimeRouter,
  type RuntimeAdapter,
  type ExplorationRuntimeRouter,
} from '../../runtime/types.js';
import { HermesRuntimeAdapter } from '../../runtime/hermes/adapter.js';
import type { HermesClient } from '../../runtime/hermes/types.js';
import type { HermesOneShotRequest, HermesOneShotResult } from '../../runtime/hermes/types.js';

// Integration test for the Exploration Bridge — active dispatch path.
//
// Per ADR-016 the bridge is Agent-neutral: it depends only on the
// `ExplorationRuntimeRouter` interface, not on any concrete Runtime.
// These tests inject a fake adapter so the bridge exercises the
// full `run(goal)` → dispatch → validate → bind → provenance →
// ingest → finalize lifecycle against a real P0001 SQLite.
//
// The fake adapter is a stand-in for `HermesRuntimeAdapter`. The
// bridge must behave identically no matter which concrete adapter
// the router holds. The fake is the proof.

class FakeAdapter implements RuntimeAdapter {
  readonly runtimeId = 'fake';
  // The next Result to return. The test sets it before each call.
  // If `nextThrow` is set, the adapter throws instead.
  nextResult: ExplorationResult | null = null;
  nextThrow: Error | null = null;
  /** Records the goal the bridge dispatched, for assertions. */
  receivedGoals: ExplorationGoal[] = [];

  async execute(goalInput: unknown): Promise<ExplorationResult> {
    this.receivedGoals.push(goalInput as ExplorationGoal);
    if (this.nextThrow !== null) {
      const err = this.nextThrow;
      this.nextThrow = null;
      throw err;
    }
    if (this.nextResult === null) {
      throw new Error('FakeAdapter: nextResult not set');
    }
    const result = this.nextResult;
    this.nextResult = null;
    return result;
  }
}

function routerFor(adapter: RuntimeAdapter): ExplorationRuntimeRouter {
  return {
    async dispatch(goal: ExplorationGoal): Promise<ExplorationResult> {
      return adapter.execute(goal);
    },
  };
}

const GOAL: ExplorationGoal = {
  id: 'goal-bridge-1',
  question: 'What AI funding rounds were announced recently in the US?',
  market: 'US',
  createdAt: '2026-09-03T10:00:00.000Z',
};

const VALID_RESULT: ExplorationResult = {
  goalId: 'goal-bridge-1',
  summary: 'Wonderful raised a Series C.',
  sources: [
    {
      url: 'https://www.reuters.com/article/wonderful-2026',
      publisher: 'Reuters',
      title: 'Wonderful Series C',
      publishedAt: '2026-09-02T10:00:00.000Z',
      accessedAt: '2026-09-03T01:00:00.000Z',
      sourceType: 'news',
      language: 'en',
    },
  ],
  evidenceCandidates: [
    {
      claim: 'Wonderful raised USD 550M in a Series C financing round.',
      subject: 'Wonderful',
      evidenceType: 'funding',
      eventAt: '2026-08-30T00:00:00.000Z',
      market: 'US',
      source: {
        url: 'https://www.reuters.com/article/wonderful-2026',
        publisher: 'Reuters',
        title: 'Wonderful Series C',
        publishedAt: '2026-09-02T10:00:00.000Z',
        accessedAt: '2026-09-03T01:00:00.000Z',
        sourceType: 'news',
        language: 'en',
      },
    },
  ],
  exploredAt: '2026-09-03T01:30:00.000Z',
};

let db: SqliteDatabase;
let tmpDir: string;
let adapter: FakeAdapter;
let bridge: ExplorationBridge;
let recorder: InMemoryRunRecorder;

beforeEach(() => {
  tmpDir = mkdtempSync(join(tmpdir(), 'opportunity-radar-bridge-'));
  db = openDatabase(join(tmpDir, 'test.db'));
  initSchema(db);
  adapter = new FakeAdapter();
  recorder = new InMemoryRunRecorder();
  bridge = createExplorationBridge({
    db,
    router: routerFor(adapter),
    runtimeId: adapter.runtimeId,
    evidenceIngest: ingest,
    runRecorder: recorder,
    runIdFactory: (): string => 'run-test-1',
    evidenceIdFactory: (i): string => `ev-test-${i}`,
    sourceIdFactory: (i): string => `src-test-${i}`,
    now: (): Date => new Date('2026-09-03T02:00:00.000Z'),
  });
});

afterEach(() => {
  db.close();
  rmSync(tmpDir, { recursive: true, force: true });
});

describe('ExplorationBridge — happy path', () => {
  it('dispatches the goal through the router, ingests all candidates, records run', async () => {
    adapter.nextResult = VALID_RESULT;
    const result = await bridge.run(GOAL);

    expect(result.status).toBe('succeeded');
    expect(result.runtimeId).toBe('fake');
    expect(result.accepted).toBe(1);
    expect(result.rejected).toBe(0);
    expect(result.errorMessage).toBeNull();

    // The bridge actually called the adapter with the Goal
    expect(adapter.receivedGoals).toEqual([GOAL]);

    // P0001 actually has the evidence
    const evidence = list(db, { market: 'US' });
    expect(evidence).toHaveLength(1);
    expect(evidence[0]?.evidence.claim).toContain('Series C');

    // The run record reflects the counts
    const run = recorder.getRun('run-test-1');
    expect(run).toBeDefined();
    expect(run?.runtimeId).toBe('fake');
    expect(run?.goal).toEqual(GOAL);
    expect(run?.candidateCount).toBe(1);
    expect(run?.acceptedCount).toBe(1);
    expect(run?.rejectedCount).toBe(0);
    expect(run?.status).toBe('succeeded');
    expect(run?.startedAt).toBe('2026-09-03T02:00:00.000Z');
    expect(run?.completedAt).toBe('2026-09-03T02:00:00.000Z');
  });

  it('handles an empty candidates list (Agent found nothing)', async () => {
    adapter.nextResult = {
      goalId: 'goal-bridge-1',
      summary: 'no signal',
      sources: [],
      evidenceCandidates: [],
      exploredAt: '2026-09-03T01:30:00.000Z',
    };
    const result = await bridge.run(GOAL);
    expect(result.status).toBe('succeeded');
    expect(result.accepted).toBe(0);
    expect(result.rejected).toBe(0);
    expect(result.result?.summary).toBe('no signal');
  });
});

describe('ExplorationBridge — adapter dispatch failure', () => {
  it('marks the run failed when the adapter throws and writes the error message', async () => {
    adapter.nextThrow = new Error('hermes: binary not found');
    const result = await bridge.run(GOAL);

    expect(result.status).toBe('failed');
    expect(result.errorMessage).toBe('hermes: binary not found');
    expect(result.accepted).toBe(0);
    expect(result.rejected).toBe(0);
    expect(result.result).toBeNull();
    expect(list(db)).toHaveLength(0);

    const run = recorder.getRun('run-test-1');
    expect(run?.status).toBe('failed');
    expect(run?.errorMessage).toBe('hermes: binary not found');
    expect(run?.completedAt).toBe('2026-09-03T02:00:00.000Z');
  });
});

describe('ExplorationBridge — Zod boundary re-validation', () => {
  it('marks the run failed when the adapter returns a malformed Result', async () => {
    // Adapter returns something that does not satisfy the schema
    // (e.g. a future Hermes version that drops `summary`).
    adapter.nextResult = {
      goalId: 'goal-bridge-1',
      // summary missing
      sources: [],
      evidenceCandidates: [],
      exploredAt: '2026-09-03T01:30:00.000Z',
    } as unknown as ExplorationResult;
    const result = await bridge.run(GOAL);

    expect(result.status).toBe('failed');
    expect(result.errorMessage).toMatch(/result/i);
    expect(result.result).toBeNull();
    expect(list(db)).toHaveLength(0);
    expect(recorder.getRun('run-test-1')?.status).toBe('failed');
  });
});

describe('ExplorationBridge — Goal / Result binding', () => {
  it('marks the run failed when result.goalId does not match the Goal', async () => {
    adapter.nextResult = {
      ...VALID_RESULT,
      goalId: 'goal-from-another-run',
    };
    const result = await bridge.run(GOAL);

    expect(result.status).toBe('failed');
    expect(result.errorMessage).toMatch(/goalId/i);
    expect(list(db)).toHaveLength(0);
    expect(recorder.getRun('run-test-1')?.status).toBe('failed');
  });
});

describe('ExplorationBridge — provenance gate', () => {
  it('rejects a candidate whose source has no URL', async () => {
    adapter.nextResult = {
      goalId: 'goal-bridge-1',
      summary: 's',
      sources: [],
      evidenceCandidates: [
        {
          claim: 'Wonderful raised USD 550M.',
          subject: 'Wonderful',
          evidenceType: 'funding',
          eventAt: '2026-08-30T00:00:00.000Z',
          market: 'US',
          source: {
            url: '', // empty URL = no provenance
            publisher: 'Anonymous',
            title: 'unsourced',
            publishedAt: null,
            accessedAt: '2026-09-03T01:00:00.000Z',
            sourceType: 'other',
            language: 'en',
          },
        },
      ],
      exploredAt: '2026-09-03T01:30:00.000Z',
    };
    const result = await bridge.run(GOAL);

    expect(result.status).toBe('succeeded');
    expect(result.accepted).toBe(0);
    expect(result.rejected).toBe(1);
    expect(list(db)).toHaveLength(0);
    const run = recorder.getRun('run-test-1');
    expect(run?.candidateCount).toBe(1);
    expect(run?.acceptedCount).toBe(0);
    expect(run?.rejectedCount).toBe(1);
  });
});

describe('ExplorationBridge — partial success', () => {
  it('accepts the valid candidate and rejects the no-URL one, status=succeeded', async () => {
    adapter.nextResult = {
      goalId: 'goal-bridge-1',
      summary: 's',
      sources: [
        {
          url: 'https://www.reuters.com/article/wonderful-2026',
          publisher: 'Reuters',
          title: 'Wonderful Series C',
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
            url: 'https://www.reuters.com/article/wonderful-2026',
            publisher: 'Reuters',
            title: 'Wonderful Series C',
            publishedAt: '2026-09-02T10:00:00.000Z',
            accessedAt: '2026-09-03T01:00:00.000Z',
            sourceType: 'news',
            language: 'en',
          },
        },
        {
          claim: 'Wonderful valued at $5B.',
          subject: 'Wonderful',
          evidenceType: 'valuation',
          eventAt: '2026-08-30T00:00:00.000Z',
          market: 'US',
          source: {
            url: '',
            publisher: 'Anonymous',
            title: 'unsourced',
            publishedAt: null,
            accessedAt: '2026-09-03T01:00:00.000Z',
            sourceType: 'other',
            language: 'en',
          },
        },
      ],
      exploredAt: '2026-09-03T01:30:00.000Z',
    };
    const result = await bridge.run(GOAL);

    expect(result.status).toBe('succeeded');
    expect(result.accepted).toBe(1);
    expect(result.rejected).toBe(1);
    expect(list(db)).toHaveLength(1);
    const run = recorder.getRun('run-test-1');
    expect(run?.candidateCount).toBe(2);
    expect(run?.acceptedCount).toBe(1);
    expect(run?.rejectedCount).toBe(1);
  });
});

describe('ExplorationBridge — P0001 dedup via shared source URL', () => {
  it('does not create duplicate source rows when two candidates share a URL', async () => {
    const sharedUrl = 'https://www.reuters.com/article/wonderful-2026';
    const sharedSource = {
      url: sharedUrl,
      publisher: 'Reuters',
      title: 'Wonderful Series C',
      publishedAt: '2026-09-02T10:00:00.000Z',
      accessedAt: '2026-09-03T01:00:00.000Z',
      sourceType: 'news' as const,
      language: 'en' as const,
    };
    adapter.nextResult = {
      goalId: 'goal-bridge-1',
      summary: 's',
      sources: [sharedSource],
      evidenceCandidates: [
        {
          claim: 'Wonderful raised USD 550M in a Series C.',
          subject: 'Wonderful',
          evidenceType: 'funding',
          eventAt: '2026-08-30T00:00:00.000Z',
          market: 'US',
          source: sharedSource,
        },
        {
          claim: 'Wonderful post-money valuation reached USD 5B.',
          subject: 'Wonderful',
          evidenceType: 'valuation',
          eventAt: '2026-08-30T00:00:00.000Z',
          market: 'US',
          source: sharedSource,
        },
      ],
      exploredAt: '2026-09-03T01:30:00.000Z',
    };
    const result = await bridge.run(GOAL);

    expect(result.accepted).toBe(2);
    const sourceCount = (db.prepare('SELECT COUNT(*) AS n FROM source_documents').get() as { n: number }).n;
    const evidenceCount = (db.prepare('SELECT COUNT(*) AS n FROM evidence').get() as { n: number }).n;
    const linkCount = (db.prepare('SELECT COUNT(*) AS n FROM evidence_sources').get() as { n: number }).n;
    expect(sourceCount).toBe(1);
    expect(evidenceCount).toBe(2);
    expect(linkCount).toBe(2);
  });
});

describe('ExplorationBridge — Hermes adapter emits unparseable provenance', () => {
  // End-to-end boundary test for the accessedAt contract.
  // The previous behavior substituted the run clock for any
  // unparseable accessedAt value, which fabricated provenance.
  // The contract is now: unparseable accessedAt → the Hermes
  // adapter throws → the bridge records the run as `failed` →
  // the error message is surfaced → NO evidence is written.
  //
  // This test wires the real HermesRuntimeAdapter through the
  // real DefaultExplorationRuntimeRouter so the boundary is
  // exercised as it is in production (minus the subprocess).

  class RecordingHermesClient implements HermesClient {
    isAvailable(): boolean { return true; }
    received: HermesOneShotRequest[] = [];
    nextStdout: string;
    constructor(nextStdout: string) { this.nextStdout = nextStdout; }
    async oneShot(req: HermesOneShotRequest): Promise<HermesOneShotResult> {
      this.received.push(req);
      return { stdout: this.nextStdout, exitCode: 0, durationMs: 1 };
    }
  }

  it('marks the run failed and writes zero Evidence when Hermes emits an unparseable accessedAt', async () => {
    // Hermes-style stdout: prose + JSON on the last line. The
    // accessedAt is "today" — not strict ISO 8601 and not
    // date-only ISO 8601, so the adapter must reject it.
    const stdout =
      'prose summary\n' +
      JSON.stringify({
        summary: 's',
        sources: [
          {
            url: 'https://example.com/a',
            publisher: 'p',
            title: 't',
            publishedAt: null,
            accessedAt: 'today', // not a date, not a datetime
            sourceType: 'news',
            language: 'en',
          },
        ],
        evidenceCandidates: [],
      });

    const hermesClient = new RecordingHermesClient(stdout);
    const hermesAdapter = new HermesRuntimeAdapter(hermesClient, {
      now: (): Date => new Date('2026-09-03T02:00:00.000Z'),
    });
    const router = new DefaultExplorationRuntimeRouter(hermesAdapter);

    const localBridge = createExplorationBridge({
      db,
      router,
      runtimeId: 'hermes',
      evidenceIngest: ingest,
      runRecorder: recorder,
      runIdFactory: (): string => 'run-test-hermes',
      evidenceIdFactory: (i: number): string => `ev-hermes-${i}`,
      sourceIdFactory: (i: number): string => `src-hermes-${i}`,
      now: (): Date => new Date('2026-09-03T02:00:00.000Z'),
    });

    const goal: ExplorationGoal = {
      id: 'goal-hermes-bad-date',
      question: 'q',
      market: 'US',
      createdAt: '2026-09-03T10:00:00.000Z',
    };
    const outcome = await localBridge.run(goal);

    // Boundary: the adapter rejected the bad provenance, the
    // bridge caught the throw, the run is failed, the error
    // is surfaced, no evidence was written.
    expect(outcome.status).toBe('failed');
    expect(outcome.accepted).toBe(0);
    expect(outcome.rejected).toBe(0);
    expect(outcome.errorMessage).toMatch(/unparseable accessedAt "today".*cannot manufacture provenance/);
    expect(outcome.result).toBeNull();

    const sourceCount = (db.prepare('SELECT COUNT(*) AS n FROM source_documents').get() as { n: number }).n;
    const evidenceCount = (db.prepare('SELECT COUNT(*) AS n FROM evidence').get() as { n: number }).n;
    expect(sourceCount).toBe(0);
    expect(evidenceCount).toBe(0);

    // The run record reflects the failure with the surfaced error.
    const run = recorder.getRun('run-test-hermes');
    expect(run?.status).toBe('failed');
    expect(run?.errorMessage).toMatch(/unparseable accessedAt/);
    expect(run?.completedAt).toBe('2026-09-03T02:00:00.000Z');
  });
});
