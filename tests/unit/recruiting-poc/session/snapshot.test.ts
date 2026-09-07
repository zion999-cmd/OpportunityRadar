import { describe, it, expect } from 'vitest';
import {
  snapshotFromTimeline,
  parseSnapshot,
} from '../../../../matching/recruiting-poc/session/snapshot.js';
import {
  readSessionSnapshot,
  writeSessionSnapshot,
} from '../../../../matching/recruiting-poc/session/snapshot-io.js';
import { Session } from '../../../../matching/recruiting-poc/session/runtime.js';
import type {
  HermesClient,
  HermesOneShotRequest,
  HermesOneShotResult,
} from '../../../../runtime/hermes/types.js';
import { mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

// A test-only queueing HermesClient (mirrors the pattern from
// runtime.test.ts). Each call to oneShot() returns the next
// queued payload (wrapped in stdout) and removes it from the
// queue. If the queue is empty, it throws.
class QueueingHermesClient implements HermesClient {
  isAvailable(): boolean {
    return true;
  }
  private readonly queue: unknown[] = [];
  public calls: HermesOneShotRequest[] = [];

  enqueue(payload: unknown): void {
    this.queue.push(payload);
  }

  async oneShot(req: HermesOneShotRequest): Promise<HermesOneShotResult> {
    this.calls.push(req);
    const next = this.queue.shift();
    if (next === undefined) {
      throw new Error('QueueingHermesClient: no queued response');
    }
    return {
      stdout: `PROSE for call ${this.calls.length}\n${JSON.stringify(next)}`,
      exitCode: 0,
      durationMs: 1,
    };
  }
}

const KAFKA_VERBATIM =
  'Kafka 这块现在没人真正 owner。最近出了几次事故，我想找个人接过去。HR 写了个 Senior Infrastructure Engineer，要求 10 年经验，但我其实不在乎几年，我要的是能扛 on-call、处理事故、写 postmortem，然后把架构问题解决掉的人。地点无所谓，能做就行。';

const TURN1_QUESTION =
  '在你说『架构问题解决掉』时，你心里想的更多是『修一个长期反复出现的隐性故障』，还是『对一个具体已知的架构痛点（比如分区布局、镜像、容量、broker 配置）做一次性的根治』？';

const TURN1_WHY =
  '这会决定 C02/C03/C08/C09 这种『在固定集群里识别并根治了某个反复出现故障模式』的候选是否真正对路，还是 C01 这种『以综合 owner 姿态把整套可观测性+事故响应打平』的形态更贴你的需求——两者都扛过 on-call，但交付形态很不同。';

const TURN1_ANSWER = '对已知频发的错误做一次性根治.';

const TURN1_DECISION = {
  action: 'ask' as const,
  question: TURN1_QUESTION,
  whyItMatters: TURN1_WHY,
};

function rel(
  candidateId: string,
  judgment: 'worth_exploring' | 'uncertain',
): unknown {
  return {
    candidateId,
    judgment,
    analysis: `analysis for ${candidateId}`,
    evidence: [`evidence for ${candidateId}`],
    unknowns: [`unknown for ${candidateId}`],
    nextStep: `next step for ${candidateId}`,
  };
}

describe('recruiting-poc/session/snapshot — Session.restore + toSnapshot', () => {
  it('restore preserves rawSituation verbatim', async () => {
    const client = new QueueingHermesClient();
    client.enqueue(TURN1_DECISION);
    const original = new Session(KAFKA_VERBATIM, client);
    await original.step();
    const snapshot = original.toSnapshot();
    const restored = Session.restore(snapshot, client);
    expect(restored.currentState.rawSituation).toBe(KAFKA_VERBATIM);
  });

  it('restore preserves rawIntentEvidence verbatim', async () => {
    const client = new QueueingHermesClient();
    client.enqueue(TURN1_DECISION);
    const original = new Session(KAFKA_VERBATIM, client);
    await original.step();
    const snapshot = original.toSnapshot();
    const withAnswer = {
      ...snapshot,
      state: {
        ...snapshot.state,
        rawIntentEvidence: [TURN1_ANSWER],
        askCount: 1,
      },
    };
    const restored = Session.restore(withAnswer, client);
    expect(restored.currentState.rawIntentEvidence).toEqual([TURN1_ANSWER]);
    expect(restored.currentState.rawIntentEvidence[0]).toBe(TURN1_ANSWER);
  });

  it('restore preserves askCount (askCount === 1)', async () => {
    const client = new QueueingHermesClient();
    client.enqueue(TURN1_DECISION);
    const original = new Session(KAFKA_VERBATIM, client);
    await original.step();
    const snapshot = original.toSnapshot();
    const withAskCount = {
      ...snapshot,
      state: {
        ...snapshot.state,
        askCount: 1,
      },
    };
    const restored = Session.restore(withAskCount, client);
    expect(restored.currentState.askCount).toBe(1);
  });

  it('restored session does NOT recreate Turn 1 — turn index advances', async () => {
    const client = new QueueingHermesClient();
    // First session: one ask turn.
    client.enqueue(TURN1_DECISION);
    const original = new Session(KAFKA_VERBATIM, client);
    const r1 = await original.step();
    expect(r1.turn.turnIndex).toBe(1);
    const snapshot = original.toSnapshot();
    expect(snapshot.turns.length).toBe(1);
    // Restore, then queue a SECOND ask. Only the second call
    // should reach hermes.
    client.enqueue({
      action: 'ask',
      question: 'second turn question',
      whyItMatters: 'second turn why',
    });
    const restored = Session.restore(snapshot, client);
    const callsBefore = client.calls.length;
    expect(callsBefore).toBe(1); // only the original Turn 1 hermes call so far
    const r2 = await restored.step();
    expect(r2.turn.turnIndex).toBe(2);
    // The restored session made exactly ONE post-restore hermes
    // call (Turn 2). Turn 1 was NOT re-spawned.
    expect(client.calls.length).toBe(2);
    // The recorded call for the restored session is the second
    // one (index 1).
    const postRestoreCall = client.calls[1]!;
    // Sanity: this call's prompt is the Turn 2 prompt, not a
    // re-emit of Turn 1's question.
    expect(postRestoreCall.prompt).toContain('User Raw Situation');
    expect(postRestoreCall.prompt).not.toContain(TURN1_QUESTION);
  });

  it('next hermes call sees the original rawSituation and the user\'s raw answer in the prompt', async () => {
    const client = new QueueingHermesClient();
    // Build the snapshot in the exact shape we will use for
    // the real resume: state has the user answer in
    // rawIntentEvidence and askCount=1; turns has the prior
    // Turn 1 ask turn.
    const turn1Snapshot = {
      turnIndex: 1,
      decision: TURN1_DECISION,
      stateAfter: {
        rawSituation: KAFKA_VERBATIM,
        rawIntentEvidence: [],
        askCount: 1,
      },
      rawOutput: 'PROSE\n' + JSON.stringify(TURN1_DECISION),
      durationMs: 1,
      forced: false,
    };
    const snapshot = {
      version: 1 as const,
      savedAtIso: new Date().toISOString(),
      state: {
        rawSituation: KAFKA_VERBATIM,
        rawIntentEvidence: [TURN1_ANSWER],
        askCount: 1,
      },
      turns: [turn1Snapshot],
      questionsAsked: [TURN1_QUESTION],
      userAnswers: [],
      rawOutputs: [turn1Snapshot.rawOutput],
      failedTurns: [],
    };
    const restored = Session.restore(snapshot, client);
    // Queue a surface response so the runtime can finish
    // cleanly after one call.
    client.enqueue({
      action: 'surface',
      relationships: [rel('C07', 'worth_exploring')],
    });
    await restored.step();
    const turn2Prompt = client.calls[0]!;
    expect(turn2Prompt.prompt).toContain(KAFKA_VERBATIM);
    expect(turn2Prompt.prompt).toContain(TURN1_ANSWER);
    // The prompt must render the user answer in the t-numbered
    // Raw Intent Evidence Timeline block.
    expect(turn2Prompt.prompt).toContain('--- Raw Intent Evidence Timeline (1) ---');
    expect(turn2Prompt.prompt).toContain('t1 (after system question 1):');
  });

  it('timeline preserves the Turn 1 question verbatim after restore', () => {
    const turn1Snapshot = {
      turnIndex: 1,
      decision: TURN1_DECISION,
      stateAfter: {
        rawSituation: KAFKA_VERBATIM,
        rawIntentEvidence: [],
        askCount: 1,
      },
      rawOutput: 'PROSE',
      durationMs: 1,
      forced: false,
    };
    const snapshot = {
      version: 1 as const,
      savedAtIso: new Date().toISOString(),
      state: {
        rawSituation: KAFKA_VERBATIM,
        rawIntentEvidence: [TURN1_ANSWER],
        askCount: 1,
      },
      turns: [turn1Snapshot],
      questionsAsked: [TURN1_QUESTION],
      userAnswers: [],
      rawOutputs: [turn1Snapshot.rawOutput],
      failedTurns: [],
    };
    const client = new QueueingHermesClient();
    const restored = Session.restore(snapshot, client);
    const timeline = restored.timeline();
    expect(timeline.questionsAsked).toHaveLength(1);
    expect(timeline.questionsAsked[0]).toBe(TURN1_QUESTION);
    expect(timeline.turns).toHaveLength(1);
    if (timeline.turns[0]!.decision.action === 'ask') {
      expect(timeline.turns[0]!.decision.question).toBe(TURN1_QUESTION);
      expect(timeline.turns[0]!.decision.whyItMatters).toBe(TURN1_WHY);
    } else {
      throw new Error('expected Turn 1 decision to be ask');
    }
  });
});

describe('recruiting-poc/session/snapshot — parseSnapshot schema validation', () => {
  it('round-trip fidelity: timeline → snapshot → restore → timeline is equal', async () => {
    const client = new QueueingHermesClient();
    client.enqueue(TURN1_DECISION);
    client.enqueue({
      action: 'surface',
      relationships: [rel('C01', 'worth_exploring')],
    });
    const original = new Session(KAFKA_VERBATIM, client);
    await original.step();
    await original.step(TURN1_ANSWER);
    const beforeTimeline = original.timeline();
    const snapshot = original.toSnapshot();
    const json = JSON.stringify(snapshot);
    const parsed = parseSnapshot(json);
    const restored = Session.restore(parsed, client);
    const afterTimeline = restored.timeline();
    expect(afterTimeline.initialSituation).toBe(beforeTimeline.initialSituation);
    expect(afterTimeline.finalState).toEqual(beforeTimeline.finalState);
    expect(afterTimeline.questionsAsked).toEqual(beforeTimeline.questionsAsked);
    expect(afterTimeline.userAnswers).toEqual(beforeTimeline.userAnswers);
    expect(afterTimeline.rawOutputs).toEqual(beforeTimeline.rawOutputs);
    expect(afterTimeline.turns.length).toBe(beforeTimeline.turns.length);
  });

  it('parseSnapshot rejects an unknown version', () => {
    const bad = JSON.stringify({
      version: 999,
      savedAtIso: new Date().toISOString(),
      state: { rawSituation: 'x', rawIntentEvidence: [], askCount: 0 },
      turns: [],
      questionsAsked: [],
      userAnswers: [],
      rawOutputs: [],
    });
    expect(() => parseSnapshot(bad)).toThrow(/version/);
  });

  it('parseSnapshot rejects a snapshot missing rawSituation', () => {
    const bad = JSON.stringify({
      version: 1,
      savedAtIso: new Date().toISOString(),
      state: { rawIntentEvidence: [], askCount: 0 },
      turns: [],
      questionsAsked: [],
      userAnswers: [],
      rawOutputs: [],
    });
    expect(() => parseSnapshot(bad)).toThrow();
  });

  it('parseSnapshot preserves verbatim Chinese characters and punctuation in Turn 1 question', () => {
    const snap = {
      version: 1 as const,
      savedAtIso: new Date().toISOString(),
      state: {
        rawSituation: KAFKA_VERBATIM,
        rawIntentEvidence: [],
        askCount: 1,
      },
      turns: [
        {
          turnIndex: 1,
          decision: TURN1_DECISION,
          stateAfter: {
            rawSituation: KAFKA_VERBATIM,
            rawIntentEvidence: [],
            askCount: 1,
          },
          rawOutput: 'PROSE',
          durationMs: 1,
          forced: false,
        },
      ],
      questionsAsked: [TURN1_QUESTION],
      userAnswers: [],
      rawOutputs: ['PROSE'],
    };
    const restored = parseSnapshot(JSON.stringify(snap));
    expect(restored.questionsAsked[0]).toBe(TURN1_QUESTION);
    expect(restored.questionsAsked[0]).toContain('『');
    expect(restored.questionsAsked[0]).toContain('』');
    expect(restored.questionsAsked[0]).toContain('、');
  });
});

describe('recruiting-poc/session/snapshot-io — filesystem round-trip', () => {
  it('writeSessionSnapshot writes a file; readSessionSnapshot returns an equal snapshot', async () => {
    const client = new QueueingHermesClient();
    client.enqueue(TURN1_DECISION);
    const session = new Session(KAFKA_VERBATIM, client);
    await session.step();
    const timeline = session.timeline();
    const tmp = mkdtempSync(join(tmpdir(), 'session-snap-'));
    const origCwd = process.cwd();
    try {
      process.chdir(tmp);
      const filePath = writeSessionSnapshot(timeline);
      const body = readFileSync(filePath, 'utf-8');
      const parsed = JSON.parse(body) as { version: number };
      expect(parsed.version).toBe(1);
      const reloaded = readSessionSnapshot(filePath);
      expect(reloaded.state.rawSituation).toBe(KAFKA_VERBATIM);
    } finally {
      process.chdir(origCwd);
      rmSync(tmp, { recursive: true, force: true });
    }
  });

  it('snapshotFromTimeline preserves the in-memory timeline exactly', async () => {
    const client = new QueueingHermesClient();
    client.enqueue(TURN1_DECISION);
    const session = new Session(KAFKA_VERBATIM, client);
    await session.step();
    const timeline = session.timeline();
    const snap = snapshotFromTimeline(timeline);
    expect(snap.state).toEqual(timeline.finalState);
    expect(snap.questionsAsked).toEqual(timeline.questionsAsked);
    expect(snap.userAnswers).toEqual(timeline.userAnswers);
    expect(snap.rawOutputs).toEqual(timeline.rawOutputs);
  });
});

describe('recruiting-poc/session/snapshot — failedTurns round-trip', () => {
  it('parseSnapshot accepts a snapshot with a failedTurns entry', () => {
    const failedTurn = {
      turnIndex: 3,
      rawOutput: 'PROSE\n{"action":"ask","question":"q3","whyItMatters":"w3"}',
      error: 'parseForcedSurfaceDecision: failed schema validation at : Unrecognized key(s) in object: \'action\'',
      forced: true,
      stateBefore: {
        rawSituation: KAFKA_VERBATIM,
        rawIntentEvidence: ['a1', 'a2'],
        askCount: 2,
      },
    };
    const snap = {
      version: 1 as const,
      savedAtIso: new Date().toISOString(),
      state: {
        rawSituation: KAFKA_VERBATIM,
        rawIntentEvidence: ['a1', 'a2'],
        askCount: 2,
      },
      turns: [],
      questionsAsked: ['q1', 'q2'],
      userAnswers: ['a1', 'a2'],
      rawOutputs: [],
      failedTurns: [failedTurn],
    };
    const parsed = parseSnapshot(JSON.stringify(snap));
    expect(parsed.failedTurns).toHaveLength(1);
    expect(parsed.failedTurns[0]!.turnIndex).toBe(3);
    expect(parsed.failedTurns[0]!.rawOutput).toBe(failedTurn.rawOutput);
    expect(parsed.failedTurns[0]!.error).toBe(failedTurn.error);
    expect(parsed.failedTurns[0]!.forced).toBe(true);
    expect(parsed.failedTurns[0]!.stateBefore.askCount).toBe(2);
    expect(parsed.failedTurns[0]!.stateBefore.rawIntentEvidence).toEqual([
      'a1',
      'a2',
    ]);
  });

  it('parseSnapshot accepts a snapshot without a failedTurns field (default = [])', () => {
    // Backward compatibility: old snapshots written before
    // the failedTurns field existed must still parse, with
    // failedTurns defaulting to [].
    const snap = {
      version: 1 as const,
      savedAtIso: new Date().toISOString(),
      state: { rawSituation: KAFKA_VERBATIM, rawIntentEvidence: [], askCount: 1 },
      turns: [],
      questionsAsked: [],
      userAnswers: [],
      rawOutputs: [],
    };
    const parsed = parseSnapshot(JSON.stringify(snap));
    expect(parsed.failedTurns).toEqual([]);
  });

  it('failed turn persists across snapshot → restore → timeline', async () => {
    const failedTurn = {
      turnIndex: 3,
      rawOutput: 'malformed raw output',
      error: 'forced-surface parser rejected this',
      forced: true,
      stateBefore: {
        rawSituation: KAFKA_VERBATIM,
        rawIntentEvidence: ['a1', 'a2'],
        askCount: 2,
      },
    };
    const snap = {
      version: 1 as const,
      savedAtIso: new Date().toISOString(),
      state: {
        rawSituation: KAFKA_VERBATIM,
        rawIntentEvidence: ['a1', 'a2'],
        askCount: 2,
      },
      turns: [],
      questionsAsked: ['q1', 'q2'],
      userAnswers: ['a1', 'a2'],
      rawOutputs: [],
      failedTurns: [failedTurn],
    };
    const client = new QueueingHermesClient();
    const restored = Session.restore(parseSnapshot(JSON.stringify(snap)), client);
    const timeline = restored.timeline();
    expect(timeline.failedTurns).toHaveLength(1);
    expect(timeline.failedTurns[0]!.turnIndex).toBe(3);
    expect(timeline.failedTurns[0]!.rawOutput).toBe('malformed raw output');
    expect(timeline.failedTurns[0]!.error).toBe('forced-surface parser rejected this');
    expect(timeline.failedTurns[0]!.forced).toBe(true);
    expect(timeline.failedTurns[0]!.stateBefore.askCount).toBe(2);
  });

  it('round-trip: a session that failed on turn 3 survives snapshot → restore with the failed turn intact', async () => {
    // Build a live session that fails on its 3rd step and
    // verify that the resulting snapshot round-trips through
    // restore with the failedTurns entry intact.
    const client = new QueueingHermesClient();
    client.enqueue(TURN1_DECISION);
    client.enqueue({ action: 'ask', question: 'q2', whyItMatters: 'w2' });
    // 3rd call: forced surface, but model returns "ask"
    // (the pre-fix bug). Parser rejects it.
    client.enqueue({ action: 'ask', question: 'q3', whyItMatters: 'w3' });
    const session = new Session(KAFKA_VERBATIM, client);
    await session.step();             // turn 1: ask
    await session.step('a1');         // turn 2: ask
    try {
      await session.step();           // turn 3: forced surface fails
    } catch {
      // expected
    }
    const snap = session.toSnapshot();
    const json = JSON.stringify(snap);
    const parsed = parseSnapshot(json);
    const restored = Session.restore(parsed, new QueueingHermesClient());
    const timeline = restored.timeline();
    expect(timeline.turns).toHaveLength(2);
    expect(timeline.failedTurns).toHaveLength(1);
    expect(timeline.failedTurns[0]!.turnIndex).toBe(3);
    expect(timeline.failedTurns[0]!.forced).toBe(true);
    expect(timeline.failedTurns[0]!.rawOutput.length).toBeGreaterThan(0);
    expect(timeline.failedTurns[0]!.error.length).toBeGreaterThan(0);
    expect(timeline.failedTurns[0]!.stateBefore.askCount).toBe(2);
  });
});
