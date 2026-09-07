import { describe, it, expect } from 'vitest';
import {
  renderIntentBoundaryArtifact,
  writeIntentBoundaryArtifact,
} from '../../../../matching/recruiting-poc/intent-boundary/artifact.js';
import { mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import type { FullPoolDiscoveredRelationship } from '../../../../matching/recruiting-poc/parse.js';
import type { IntentBoundaryOutput } from '../../../../matching/recruiting-poc/intent-boundary/parse.js';

const discoveredRelationships: ReadonlyArray<FullPoolDiscoveredRelationship> = [
  {
    candidateId: 'C03',
    judgment: 'worth_exploring',
    analysis: 'C03 actually owned a Kafka deployment at the scale implied.',
    evidence: ['C03: "I owned the Kafka deployment that handled order events."'],
    unknowns: ['Whether C03 has run a cluster at the scale implied by the employer situation.'],
    nextStep: 'Ask C03 for the most recent postmortem.',
  },
  {
    candidateId: 'C10',
    judgment: 'uncertain',
    analysis: 'C10 is a strong SRE but has no streaming experience.',
    evidence: ['C10: "I do incident command, write postmortems."'],
    unknowns: ['Whether C10 can ramp on the streaming layer in a reasonable time.'],
    nextStep: 'Probe C10 on how they would learn the streaming layer in week 1.',
  },
];

const intentBoundary: IntentBoundaryOutput = {
  question: 'Is the streaming layer a hard requirement, or is it a proxy for a different intent?',
  whyItMatters: 'If it is a proxy, candidates with comparable but different streaming backgrounds become worth_exploring; if it is a hard requirement, only direct streaming owners qualify.',
  affectedRelationships: [
    {
      candidateId: 'C03',
      ifAnswerA: 'Remains worth_exploring as a direct streaming owner.',
      ifAnswerB: 'Likely drops to uncertain unless the new constraint is met.',
    },
    {
      candidateId: 'C10',
      ifAnswerA: 'Becomes worth_exploring as a strong SRE if the streaming requirement is a proxy.',
      ifAnswerB: 'Remains uncertain if the streaming requirement is a hard constraint.',
    },
  ],
  evidence: [
    'Employer: "Kafka 这块现在没人真正 owner"',
    'C10: "I do incident command, write postmortems"',
  ],
};

const baseSucceeded = {
  status: 'succeeded' as const,
  discoveredRelationships,
  intentBoundary,
  errorMessage: null,
  durationMs: 4321,
  stdout: '',
};

describe('recruiting-poc/intent-boundary/artifact', () => {
  it('contains the 8 required sections in order (Runtime Metadata, Employer, Stage 1, Question, Why It Matters, Affected, Evidence, [Raw output only on failure])', () => {
    const md = renderIntentBoundaryArtifact(baseSucceeded);
    const order = [
      '## 8. Runtime Metadata',
      '## 1. Employer Raw Situation',
      '## 2. Stage 1 Discovered Relationships (2)',
      '## 3. Intent Boundary Question',
      '## 4. Why It Matters',
      '## 5. Affected Relationships',
      '## 6. Evidence',
    ];
    let last = -1;
    for (const heading of order) {
      const idx = md.indexOf(heading);
      expect(idx, `missing heading: ${heading}`).toBeGreaterThan(-1);
      expect(idx, `out-of-order: ${heading}`).toBeGreaterThan(last);
      last = idx;
    }
  });

  it('embeds the Employer Raw Situation verbatim', () => {
    const md = renderIntentBoundaryArtifact(baseSucceeded);
    expect(md).toContain('Kafka 这块现在没人真正 owner');
  });

  it('embeds the Stage 1 relationships with their 5-field shape', () => {
    const md = renderIntentBoundaryArtifact(baseSucceeded);
    expect(md).toContain('### C03 — worth_exploring');
    expect(md).toContain('### C10 — uncertain');
    expect(md).toContain('**analysis**');
    expect(md).toContain('**evidence**');
    expect(md).toContain('**unknowns**');
  });

  it('embeds the question, whyItMatters, and affected relationships', () => {
    const md = renderIntentBoundaryArtifact(baseSucceeded);
    expect(md).toContain(intentBoundary.question);
    expect(md).toContain(intentBoundary.whyItMatters);
    expect(md).toContain('### C03');
    expect(md).toContain('if answer A: Remains worth_exploring');
    expect(md).toContain('if answer B: Likely drops to uncertain');
  });

  it('embeds the evidence array as bullet points', () => {
    const md = renderIntentBoundaryArtifact(baseSucceeded);
    for (const e of intentBoundary.evidence) {
      expect(md).toContain(`- ${e}`);
    }
  });

  it('includes runtime metadata: status, duration, counts, stage', () => {
    const md = renderIntentBoundaryArtifact(baseSucceeded);
    expect(md).toContain('status: succeeded');
    expect(md).toContain('durationMs: 4321');
    expect(md).toContain('discoveredRelationshipCount: 2');
    expect(md).toContain('affectedRelationshipCount: 2');
    expect(md).toContain('evidenceCount: 2');
    expect(md).toContain('stage: 2 of 2 (Intent Boundary Discovery)');
  });

  it('failed runs include the Raw Hermes Output (debug) section', () => {
    const md = renderIntentBoundaryArtifact({
      ...baseSucceeded,
      status: 'failed',
      errorMessage: 'parse failed',
      intentBoundary: null,
      stdout: 'partial agent output that did not parse',
    });
    expect(md).toContain('## 7. Raw Hermes Output (debug)');
    expect(md).toContain('partial agent output that did not parse');
  });

  it('does NOT include the Raw Hermes Output section on success', () => {
    const md = renderIntentBoundaryArtifact(baseSucceeded);
    expect(md).not.toContain('## 7. Raw Hermes Output (debug)');
  });

  it('writeIntentBoundaryArtifact writes a file under artifacts/recruiting-poc/ with expected content', () => {
    const tmp = mkdtempSync(join(tmpdir(), 'intent-boundary-art-'));
    const origCwd = process.cwd();
    try {
      process.chdir(tmp);
      const path = writeIntentBoundaryArtifact(baseSucceeded);
      const body = readFileSync(path, 'utf-8');
      expect(body).toContain('## 3. Intent Boundary Question');
      expect(body).toContain(intentBoundary.question);
      expect(body).toContain('## 5. Affected Relationships');
      expect(body).toContain('### C03');
    } finally {
      process.chdir(origCwd);
      rmSync(tmp, { recursive: true, force: true });
    }
  });
});
