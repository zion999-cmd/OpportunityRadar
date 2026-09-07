import { describe, it, expect } from 'vitest';
import {
  renderSessionArtifact,
  writeSessionArtifact,
} from '../../../../matching/recruiting-poc/session/artifact.js';
import type { SessionTimeline, SessionTurn } from '../../../../matching/recruiting-poc/session/runtime.js';
import { mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

function turn(
  index: number,
  decision: SessionTurn['decision'],
  options: { forced?: boolean; rawOutput?: string; durationMs?: number } = {},
): SessionTurn {
  return {
    turnIndex: index,
    decision,
    stateAfter: {
      rawSituation: 'my raw situation',
      rawIntentEvidence: [],
      askCount: 0,
    },
    prompt: 'PROMPT_PLACEHOLDER',
    rawOutput: options.rawOutput ?? `RAW_OUTPUT for turn ${index}`,
    durationMs: options.durationMs ?? 100,
    forced: options.forced ?? false,
  };
}

function buildTimeline(turns: SessionTurn[], userAnswers: string[] = []): SessionTimeline {
  // Walk the turns in order, tracking the running askCount
  // and rawIntentEvidence. Each turn's stateAfter must
  // reflect the state AT THE END of that turn.
  const computedTurns: SessionTurn[] = [];
  let runningAskCount = 0;
  const runningEvidence: string[] = [];
  for (let i = 0; i < turns.length; i += 1) {
    const userAnswer = userAnswers[i];
    if (userAnswer !== undefined) {
      runningEvidence.push(userAnswer);
    }
    if (turns[i]!.decision.action === 'ask') {
      runningAskCount += 1;
    }
    const original = turns[i]!;
    computedTurns.push({
      ...original,
      stateAfter: {
        rawSituation: 'my raw situation',
        rawIntentEvidence: runningEvidence.slice(),
        askCount: runningAskCount,
      },
    });
  }
  const finalTurn = computedTurns[computedTurns.length - 1];
  const finalState = finalTurn
    ? finalTurn.stateAfter
    : { rawSituation: 'my raw situation', rawIntentEvidence: [] as string[], askCount: 0 };
  return {
    initialSituation: 'my raw situation',
    finalState,
    turns: computedTurns,
    questionsAsked: computedTurns
      .filter((t) => t.decision.action === 'ask')
      .map((t) => (t.decision as { question: string }).question),
    userAnswers,
    rawOutputs: computedTurns.map((t) => t.rawOutput),
    failedTurns: [],
    finalDecision: finalTurn ? finalTurn.decision : null,
  };
}

describe('recruiting-poc/session/artifact', () => {
  it('contains the 10 required sections in order', () => {
    const timeline = buildTimeline([
      turn(1, { action: 'ask', question: 'q1', whyItMatters: 'w1' }),
      turn(2, {
        action: 'surface',
        relationships: [
          {
            candidateId: 'C03',
            judgment: 'worth_exploring',
            analysis: 'a',
            evidence: ['e'],
            unknowns: ['u'],
            nextStep: 'n',
          },
        ],
      }),
    ], ['a1']);
    const md = renderSessionArtifact(timeline);
    const order = [
      '## 1. Original Raw Situation',
      '## 2. Raw Intent Evidence Timeline',
      '## 3. Runtime Decisions',
      '## 4. Questions Asked',
      '## 5. User Answers',
      '## 6. Final Relationships',
      '## 7. Evidence / Unknowns / Next Actions',
      '## 8. Raw Hermes Outputs',
      '## 9. Runtime Metadata',
      '## 10. Session Timeline (t-numbered)',
    ];
    let last = -1;
    for (const h of order) {
      const idx = md.indexOf(h);
      expect(idx, `missing: ${h}`).toBeGreaterThan(-1);
      expect(idx, `out-of-order: ${h}`).toBeGreaterThan(last);
      last = idx;
    }
  });

  it('preserves the original raw situation verbatim', () => {
    const timeline = buildTimeline([
      turn(1, { action: 'surface', relationships: [] }),
    ]);
    const md = renderSessionArtifact(timeline);
    expect(md).toContain('```');
    expect(md).toContain('my raw situation');
  });

  it('renders the Raw Intent Evidence Timeline as t-numbered blocks', () => {
    const timeline = buildTimeline([
      turn(1, { action: 'ask', question: 'q1', whyItMatters: 'w1' }),
      turn(2, { action: 'ask', question: 'q2', whyItMatters: 'w2' }),
      turn(3, { action: 'surface', relationships: [] }, { forced: true }),
    ], ['answer 1', 'answer 2']);
    const md = renderSessionArtifact(timeline);
    expect(md).toContain('### t2 (after system question 1)');
    expect(md).toContain('answer 1');
    expect(md).toContain('### t4 (after system question 2)');
    expect(md).toContain('answer 2');
  });

  it('renders Runtime Decisions with one block per turn', () => {
    const timeline = buildTimeline([
      turn(1, { action: 'ask', question: 'q1', whyItMatters: 'w1' }),
      turn(2, { action: 'surface', relationships: [] }),
    ], ['a1']);
    const md = renderSessionArtifact(timeline);
    expect(md).toContain('### Turn 1');
    expect(md).toContain('action: ask');
    expect(md).toContain('question: q1');
    expect(md).toContain('### Turn 2');
    expect(md).toContain('action: surface');
    expect(md).toContain('relationshipCount: 0');
  });

  it('marks forced-surface turns explicitly', () => {
    const timeline = buildTimeline([
      turn(1, { action: 'ask', question: 'q1', whyItMatters: 'w1' }),
      turn(2, { action: 'ask', question: 'q2', whyItMatters: 'w2' }),
      turn(3, { action: 'surface', relationships: [] }, { forced: true }),
    ], ['a1', 'a2']);
    const md = renderSessionArtifact(timeline);
    expect(md).toContain('### Turn 3 (forced surface — budget exhausted)');
  });

  it('renders the Final Relationships with the 5-field shape', () => {
    const timeline = buildTimeline([
      turn(1, {
        action: 'surface',
        relationships: [
          {
            candidateId: 'C03',
            judgment: 'worth_exploring',
            analysis: 'C03 owned a Kafka cluster at scale.',
            evidence: ['C03: "I owned the Kafka deployment"'],
            unknowns: ['C03 cluster size not stated.'],
            nextStep: 'Ask C03 for the most recent postmortem.',
          },
        ],
      }),
    ]);
    const md = renderSessionArtifact(timeline);
    expect(md).toContain('### C03 — worth_exploring');
    expect(md).toContain('**analysis**');
    expect(md).toContain('**evidence**');
    expect(md).toContain('**unknowns**');
    expect(md).toContain('**nextStep**');
  });

  it('preserves the Raw Hermes Outputs verbatim', () => {
    const timeline = buildTimeline([
      turn(1, { action: 'surface', relationships: [] }, { rawOutput: 'PROMPT_OUTPUT_1' }),
      turn(2, { action: 'surface', relationships: [] }, { rawOutput: 'PROMPT_OUTPUT_2' }),
    ]);
    const md = renderSessionArtifact(timeline);
    expect(md).toContain('### Turn 1');
    expect(md).toContain('PROMPT_OUTPUT_1');
    expect(md).toContain('### Turn 2');
    expect(md).toContain('PROMPT_OUTPUT_2');
  });

  it('renders Runtime Metadata with budget, counts, and forbidden-surface audit', () => {
    const timeline = buildTimeline([
      turn(1, { action: 'ask', question: 'q1', whyItMatters: 'w1' }),
      turn(2, { action: 'surface', relationships: [] }),
    ], ['a1']);
    const md = renderSessionArtifact(timeline);
    expect(md).toContain('sessionState: { rawSituation, rawIntentEvidence[], askCount }');
    expect(md).toContain('turnCount: 2');
    expect(md).toContain('questionsAskedCount: 1');
    expect(md).toContain('userAnswersCount: 1');
    expect(md).toContain('askBudget: 2');
    expect(md).toContain('finalAskCount: 1');
    expect(md).toContain('forbiddenSurface: false');
  });

  it('renders the t-numbered session timeline in event order', () => {
    const timeline = buildTimeline([
      turn(1, { action: 'ask', question: 'q1', whyItMatters: 'w1' }),
      turn(2, { action: 'ask', question: 'q2', whyItMatters: 'w2' }),
      turn(3, { action: 'surface', relationships: [] }, { forced: true }),
    ], ['a1', 'a2']);
    const md = renderSessionArtifact(timeline);
    expect(md).toContain('## 10. Session Timeline (t-numbered)');
    // t0: situation
    expect(md).toMatch(/- t0: user typed raw situation/);
    // t1: system asked q1
    expect(md).toMatch(/- t1: system asked: q1/);
    // t2: user answered a1
    expect(md).toMatch(/- t2: user answered \(raw intent evidence appended\): a1/);
    // t3: system asked q2
    expect(md).toMatch(/- t3: system asked: q2/);
    // t4: user answered a2
    expect(md).toMatch(/- t4: user answered \(raw intent evidence appended\): a2/);
    // t5: system surfaced
    expect(md).toMatch(/- t5: system surfaced 0 relationship\(s\)/);
  });

  it('does NOT introduce Job/Profile/schema/filter/score/rank in any section', () => {
    const timeline = buildTimeline([
      turn(1, { action: 'ask', question: 'q1', whyItMatters: 'w1' }),
      turn(2, {
        action: 'surface',
        relationships: [
          {
            candidateId: 'C03',
            judgment: 'worth_exploring',
            analysis: 'analysis text',
            evidence: ['evidence text'],
            unknowns: ['unknown text'],
            nextStep: 'next step text',
          },
        ],
      }),
    ], ['a1']);
    const md = renderSessionArtifact(timeline);
    const lower = md.toLowerCase();
    for (const forbidden of [
      'jobprofile', 'candidateprofile', 'requirements[]', 'skills[]',
      'tags[]', 'hardconstraints[]', 'preference schema', 'match %',
      'match%', 'cosine', 'embedding', 'vector', 'taxonomy', 'keyword search',
      'job schema', 'filter condition',
    ]) {
      expect(lower, `forbidden token: ${forbidden}`).not.toContain(forbidden);
    }
  });

  it('writeSessionArtifact writes a file under artifacts/recruiting-poc/ with expected content', () => {
    const timeline = buildTimeline([
      turn(1, { action: 'surface', relationships: [] }),
    ]);
    const tmp = mkdtempSync(join(tmpdir(), 'session-art-'));
    const origCwd = process.cwd();
    try {
      process.chdir(tmp);
      const path = writeSessionArtifact(timeline);
      const body = readFileSync(path, 'utf-8');
      expect(body).toContain('## 1. Original Raw Situation');
      expect(body).toContain('## 6. Final Relationships');
      expect(body).toContain('## 9. Runtime Metadata');
      expect(body).toContain('## 10. Session Timeline (t-numbered)');
    } finally {
      process.chdir(origCwd);
      rmSync(tmp, { recursive: true, force: true });
    }
  });
});
