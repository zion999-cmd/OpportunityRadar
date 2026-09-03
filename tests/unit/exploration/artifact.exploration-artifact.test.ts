import { describe, it, expect } from 'vitest';
import {
  decideCandidate,
  renderExplorationArtifact,
  type AcceptedEvidenceRow,
} from '../../../exploration/artifact/exploration-artifact.js';
import type { ExplorationGoal } from '../../../exploration/contracts/exploration-goal.js';
import type { EvidenceCandidate } from '../../../exploration/contracts/evidence-candidate.js';
import type { ExplorationResult } from '../../../exploration/contracts/exploration-result.js';
import type {
  ExplorationRunOutcome,
  RunRecord,
} from '../../../exploration/bridge/exploration-bridge.js';

// Unit tests for the exploration-artifact renderer. The renderer
// is a pure formatter: the tests build an in-memory ExplorationResult,
// RunRecord, and the list of P0001 evidence rows the bridge wrote
// for this run, and assert on the produced Markdown.

const GOAL: ExplorationGoal = {
  id: 'goal-test-1',
  question: 'List 3 recent AI funding rounds in the US.',
  market: 'US',
  createdAt: '2026-09-04T00:00:00.000Z',
};

const CANDIDATE_ACCEPTED: EvidenceCandidate = {
  claim: 'Anthropic raised $65B in Series H at $965B valuation.',
  subject: 'Anthropic',
  evidenceType: 'funding',
  eventAt: '2026-05-28T00:00:00.000Z',
  market: 'US',
  source: {
    url: 'https://www.anthropic.com/news/series-h',
    publisher: 'Anthropic',
    title: 'Anthropic raises $65B in Series H funding at $965B post-money valuation',
    publishedAt: '2026-05-28T00:00:00.000Z',
    accessedAt: '2026-09-04T00:00:00.000Z',
    sourceType: 'company_announcement',
    language: 'en',
  },
};

const CANDIDATE_REJECTED_URL: EvidenceCandidate = {
  ...CANDIDATE_ACCEPTED,
  claim: 'Some claim without a URL.',
  source: { ...CANDIDATE_ACCEPTED.source, url: '' },
};

const CANDIDATE_REJECTED_P0001: EvidenceCandidate = {
  ...CANDIDATE_ACCEPTED,
  claim: 'Claim that P0001 refused to ingest.',
  subject: 'Mystery',
};

const RESULT: ExplorationResult = {
  goalId: 'goal-test-1',
  summary: 'Three US AI funding rounds were verified: Anthropic, X, Y.',
  sources: [
    {
      url: 'https://www.anthropic.com/news/series-h',
      publisher: 'Anthropic',
      title: 'Anthropic raises $65B in Series H funding at $965B post-money valuation',
      publishedAt: '2026-05-28T00:00:00.000Z',
      accessedAt: '2026-09-04T00:00:00.000Z',
      sourceType: 'company_announcement',
      language: 'en',
    },
  ],
  evidenceCandidates: [CANDIDATE_ACCEPTED, CANDIDATE_REJECTED_URL, CANDIDATE_REJECTED_P0001],
  exploredAt: '2026-09-04T00:00:00.000Z',
};

const RUN_RECORD: RunRecord = {
  id: 'run-1',
  goal: GOAL,
  runtimeId: 'hermes',
  startedAt: '2026-09-04T00:00:00.000Z',
  completedAt: '2026-09-04T00:01:00.000Z',
  status: 'succeeded',
  candidateCount: 3,
  acceptedCount: 1,
  rejectedCount: 2,
  errorMessage: null,
};

const OUTCOME: ExplorationRunOutcome = {
  runId: 'run-1',
  status: 'succeeded',
  runtimeId: 'hermes',
  accepted: 1,
  rejected: 2,
  errorMessage: null,
  result: RESULT,
};

const ACCEPTED: AcceptedEvidenceRow[] = [
  {
    id: 'ev-anthropic-1',
    claim: 'Anthropic raised $65B in Series H at $965B valuation.',
    sourceId: 'src-anthropic-1',
    sourceCanonicalUrl: 'https://www.anthropic.com/news/series-h',
  },
];

describe('decideCandidate', () => {
  it('rejects candidates with an empty source URL via the P0002 §6 provenance gate', () => {
    const decision = decideCandidate(CANDIDATE_REJECTED_URL, new Map());
    expect(decision.kind).toBe('rejected');
    if (decision.kind === 'rejected') {
      expect(decision.reason).toBe('no_source_url');
      expect(decision.detail).toMatch(/P0002 §6 provenance gate/);
    }
  });

  it('accepts candidates whose claim matches a P0001 evidence row written by this run', () => {
    const acceptedByClaim = new Map<string, AcceptedEvidenceRow>([
      [CANDIDATE_ACCEPTED.claim, ACCEPTED[0]!],
    ]);
    const decision = decideCandidate(CANDIDATE_ACCEPTED, acceptedByClaim);
    expect(decision.kind).toBe('accepted');
    if (decision.kind === 'accepted') {
      expect(decision.evidenceId).toBe('ev-anthropic-1');
      expect(decision.sourceId).toBe('src-anthropic-1');
      expect(decision.sourceCanonicalUrl).toBe('https://www.anthropic.com/news/series-h');
    }
  });

  it("rejects candidates whose claim is not in the run's evidence rows (P0001 ingest failed)", () => {
    const decision = decideCandidate(CANDIDATE_REJECTED_P0001, new Map());
    expect(decision.kind).toBe('rejected');
    if (decision.kind === 'rejected') {
      expect(decision.reason).toBe('p0001_ingest_failed');
      expect(decision.detail).toMatch(/no specific reason captured/i);
    }
  });
});

describe('renderExplorationArtifact', () => {
  it('renders all required sections in the required order', () => {
    const md = renderExplorationArtifact({
      goal: GOAL,
      runRecord: RUN_RECORD,
      outcome: OUTCOME,
      acceptedEvidence: ACCEPTED,
    });
    const sections = [
      '# Exploration Run',
      '## Goal',
      '## Run Metadata',
      '## Agent Summary',
      '## Sources',
      '## Evidence Candidates',
      '## Accepted Evidence',
    ];
    let cursor = 0;
    for (const heading of sections) {
      const idx = md.indexOf(heading, cursor);
      expect(idx, `missing or out-of-order section: ${heading}`).toBeGreaterThanOrEqual(cursor);
      cursor = idx + heading.length;
    }
  });

  it('preserves the Agent summary verbatim — no re-summarization', () => {
    const md = renderExplorationArtifact({
      goal: GOAL,
      runRecord: RUN_RECORD,
      outcome: OUTCOME,
      acceptedEvidence: ACCEPTED,
    });
    expect(md).toContain('Three US AI funding rounds were verified: Anthropic, X, Y.');
  });

  it('emits per-candidate accept/reject decisions and the existing rejection reason for empty URLs', () => {
    const md = renderExplorationArtifact({
      goal: GOAL,
      runRecord: RUN_RECORD,
      outcome: OUTCOME,
      acceptedEvidence: ACCEPTED,
    });
    expect(md).toContain('### Candidate 1 — Anthropic');
    expect(md).toContain('final decision: **accepted**');
    expect(md).toContain('`ev-anthropic-1`');
    expect(md).toContain('### Candidate 2 — Anthropic');
    expect(md).toContain('final decision: **rejected**');
    expect(md).toContain('P0002 §6 provenance gate');
    expect(md).toContain('### Candidate 3 — Mystery');
    expect(md).toContain('P0001 ingest failed (no specific reason captured by the existing pipeline)');
  });

  it('lists every source in the Agent result with all fields the task requires', () => {
    const md = renderExplorationArtifact({
      goal: GOAL,
      runRecord: RUN_RECORD,
      outcome: OUTCOME,
      acceptedEvidence: ACCEPTED,
    });
    expect(md).toContain('### Source 1 — Anthropic raises $65B in Series H funding at $965B post-money valuation');
    expect(md).toContain('canonicalUrl: https://www.anthropic.com/news/series-h');
    expect(md).toContain('publisher: Anthropic');
    expect(md).toContain('publishedAt: 2026-05-28T00:00:00.000Z');
    expect(md).toContain('accessedAt: 2026-09-04T00:00:00.000Z');
    expect(md).toContain('sourceType: company_announcement');
    expect(md).toContain('language: en');
  });

  it('lists the accepted evidence rows with their P0001 ids and source URLs', () => {
    const md = renderExplorationArtifact({
      goal: GOAL,
      runRecord: RUN_RECORD,
      outcome: OUTCOME,
      acceptedEvidence: ACCEPTED,
    });
    expect(md).toContain('### Evidence `ev-anthropic-1`');
    expect(md).toContain('sourceDocumentId: `src-anthropic-1`');
    expect(md).toContain('source URL: https://www.anthropic.com/news/series-h');
  });

  it('renders the goal fields including timeWindow and evidenceInterests', () => {
    const goalWithExtras: ExplorationGoal = {
      ...GOAL,
      timeWindow: 'last 30 days',
      evidenceInterests: ['funding', 'product_launch'],
    };
    const md = renderExplorationArtifact({
      goal: goalWithExtras,
      runRecord: { ...RUN_RECORD, goal: goalWithExtras },
      outcome: OUTCOME,
      acceptedEvidence: ACCEPTED,
    });
    expect(md).toContain('timeWindow: last 30 days');
    expect(md).toContain('evidenceInterests: funding, product_launch');
  });

  it('emits "—" for missing optional fields rather than "undefined" or "null"', () => {
    const goalNoExtras: ExplorationGoal = {
      id: 'goal-x',
      question: 'q',
      market: 'US',
      createdAt: '2026-09-04T00:00:00.000Z',
    };
    const md = renderExplorationArtifact({
      goal: goalNoExtras,
      runRecord: { ...RUN_RECORD, goal: goalNoExtras },
      outcome: OUTCOME,
      acceptedEvidence: ACCEPTED,
    });
    expect(md).toContain('timeWindow: —');
    expect(md).toContain('evidenceInterests: —');
  });

  it('handles a failed run where result is null', () => {
    const failedOutcome: ExplorationRunOutcome = {
      ...OUTCOME,
      status: 'failed',
      result: null,
      errorMessage: 'parse: sources[0].publishedAt: invalid datetime',
      accepted: 0,
      rejected: 0,
    };
    const failedRun: RunRecord = {
      ...RUN_RECORD,
      status: 'failed',
      candidateCount: 0,
      acceptedCount: 0,
      rejectedCount: 0,
      errorMessage: failedOutcome.errorMessage,
    };
    const md = renderExplorationArtifact({
      goal: GOAL,
      runRecord: failedRun,
      outcome: failedOutcome,
      acceptedEvidence: [],
    });
    expect(md).toContain('status: failed');
    expect(md).toContain('parse: sources[0].publishedAt: invalid datetime');
    expect(md).toContain('_No summary returned by the Agent._');
    expect(md).toContain('_No sources were listed by the Agent._');
    expect(md).toContain('_No evidence candidates were proposed by the Agent._');
    expect(md).toContain('_No Evidence rows were written to the P0001 Evidence Store for this run._');
  });
});
