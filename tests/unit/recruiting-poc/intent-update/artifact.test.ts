import { describe, it, expect } from 'vitest';
import {
  renderIntentUpdateArtifact,
  writeIntentUpdateArtifact,
} from '../../../../matching/recruiting-poc/intent-update/artifact.js';
import { computeRelationshipSpaceDiff } from '../../../../matching/recruiting-poc/intent-update/diff.js';
import type { FullPoolDiscoveredRelationship } from '../../../../matching/recruiting-poc/parse.js';
import { mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import {
  EMPLOYER_RAW_SITUATION,
} from '../../../../matching/recruiting-poc/cases.js';
import {
  STAGE2_INTENT_BOUNDARY_QUESTION,
  ANSWER_A_VERBATIM,
  ANSWER_B_VERBATIM,
} from '../../../../matching/recruiting-poc/intent-update/answers.js';

function rel(
  candidateId: string,
  judgment: 'worth_exploring' | 'uncertain',
  analysis = `analysis for ${candidateId}`,
): FullPoolDiscoveredRelationship {
  return {
    candidateId,
    judgment,
    analysis,
    evidence: [`evidence for ${candidateId}`],
    unknowns: [`unknown for ${candidateId}`],
    nextStep: `next step for ${candidateId}`,
  };
}

const baseline: ReadonlyArray<FullPoolDiscoveredRelationship> = [
  rel('C01', 'worth_exploring'),
  rel('C02', 'worth_exploring'),
  rel('C03', 'worth_exploring'),
  rel('C07', 'uncertain'),
  rel('C08', 'uncertain'),
  rel('C09', 'worth_exploring'),
];

const runAOk = {
  status: 'succeeded' as const,
  summary: 'Under Answer A, the Kafka-native candidates dominate.',
  relationships: [rel('C01', 'worth_exploring'), rel('C02', 'worth_exploring')],
  errorMessage: null,
  durationMs: 12000,
  stdout: 'PROSE A\n{"summary":"Under Answer A...","relationships":[]}\n',
  hermesInvocations: 1 as const,
};

const runBOk = {
  status: 'succeeded' as const,
  summary: 'Under Answer B, the operational candidates dominate.',
  relationships: [
    rel('C07', 'worth_exploring', 'C07 becomes worth_exploring under Answer B.'),
    rel('C10', 'worth_exploring', 'C10 becomes worth_exploring under Answer B.'),
  ],
  errorMessage: null,
  durationMs: 14000,
  stdout: 'PROSE B\n{"summary":"Under Answer B...","relationships":[]}\n',
  hermesInvocations: 1 as const,
};

const baseInputs = {
  baseline,
  runA: runAOk,
  runB: runBOk,
  diff: computeRelationshipSpaceDiff(
    baseline,
    runAOk.relationships,
    runBOk.relationships,
  ),
};

describe('recruiting-poc/intent-update/artifact', () => {
  it('contains the 11 required sections in order', () => {
    const md = renderIntentUpdateArtifact(baseInputs);
    const order = [
      '## 1. Original Employer Raw Situation',
      '## 2. Stage 2 Intent Boundary Question',
      '## 3. Answer A',
      '## 4. Run A Relationships',
      '## 5. Answer B',
      '## 6. Run B Relationships',
      '## 7. Stage 1 Baseline Relationships',
      '## 8. Deterministic Relationship-Space Diff',
      '## 9. Runtime Metadata',
      '## 10. Raw Output A',
      '## 11. Raw Output B',
    ];
    let last = -1;
    for (const heading of order) {
      const idx = md.indexOf(heading);
      expect(idx, `missing heading: ${heading}`).toBeGreaterThan(-1);
      expect(idx, `out-of-order: ${heading}`).toBeGreaterThan(last);
      last = idx;
    }
  });

  it('embeds the Original Employer Raw Situation verbatim', () => {
    const md = renderIntentUpdateArtifact(baseInputs);
    expect(md).toContain('Kafka 这块现在没人真正 owner');
  });

  it('embeds the Stage 2 Intent Boundary Question verbatim', () => {
    const md = renderIntentUpdateArtifact(baseInputs);
    expect(md).toContain(STAGE2_INTENT_BOUNDARY_QUESTION);
  });

  it('embeds Answer A and Answer B verbatim', () => {
    const md = renderIntentUpdateArtifact(baseInputs);
    expect(md).toContain(ANSWER_A_VERBATIM);
    expect(md).toContain(ANSWER_B_VERBATIM);
  });

  it('embeds Run A and Run B relationships with 5-field shape', () => {
    const md = renderIntentUpdateArtifact(baseInputs);
    expect(md).toContain('### C01 — worth_exploring');
    expect(md).toContain('### C07 — worth_exploring');
    expect(md).toContain('**analysis**');
    expect(md).toContain('**evidence**');
    expect(md).toContain('**unknowns**');
    expect(md).toContain('**nextStep**');
  });

  it('embeds the Stage 1 baseline relationships', () => {
    const md = renderIntentUpdateArtifact(baseInputs);
    expect(md).toContain('### C01 — worth_exploring');
    expect(md).toContain('### C02 — worth_exploring');
    expect(md).toContain('### C03 — worth_exploring');
    expect(md).toContain('### C07 — uncertain');
    expect(md).toContain('### C08 — uncertain');
    expect(md).toContain('### C09 — worth_exploring');
  });

  it('renders the deterministic diff as a labeled set of lines', () => {
    const md = renderIntentUpdateArtifact(baseInputs);
    expect(md).toContain('## 8. Deterministic Relationship-Space Diff');
    // baseline = [C01, C02, C03, C07, C08, C09]
    // A       = [C01, C02]
    // B       = [C07, C10]
    expect(md).toMatch(/surfacedInBaseline: C01, C02, C03, C07, C08, C09/);
    expect(md).toMatch(/surfacedInA: C01, C02/);
    expect(md).toMatch(/surfacedInB: C07, C10/);
    // A is a subset of baseline → addedInA is empty.
    expect(md).toMatch(/addedInA: \(empty\)/);
    expect(md).toMatch(/removedInA: C03, C07, C08, C09/);
    // B adds C10 (not in baseline) and drops C01/C02/C03/C08/C09.
    expect(md).toMatch(/addedInB: C10/);
    expect(md).toMatch(/removedInB: C01, C02, C03, C08, C09/);
    // judgmentChanged: shared members with a different judgment.
    // A ∩ baseline = {C01, C02}; both keep worth_exploring → empty.
    // B ∩ baseline = {C07}; baseline=uncertain, B=worth_exploring → C07.
    expect(md).toMatch(/judgmentChangedInA: \(empty\)/);
    expect(md).toMatch(/judgmentChangedInB: C07/);
  });

  it('includes runtime metadata with budget and counts', () => {
    const md = renderIntentUpdateArtifact(baseInputs);
    expect(md).toContain('stage: 3 of 3');
    expect(md).toContain('method: two independent full-pool discovery Hermes one-shots');
    expect(md).toContain('comparison: deterministic set operations');
    expect(md).toContain('runA: status=succeeded durationMs=12000');
    expect(md).toContain('runB: status=succeeded durationMs=14000');
    expect(md).toContain('totalDurationMs: 26000');
    expect(md).toContain('hermesInvocations: 2 (Run A + Run B, fixed budget = 2)');
    expect(md).toContain('baselineRelationshipCount: 6');
  });

  it('preserves the raw output for both runs', () => {
    const md = renderIntentUpdateArtifact(baseInputs);
    expect(md).toContain('## 10. Raw Output A');
    expect(md).toContain('PROSE A');
    expect(md).toContain('## 11. Raw Output B');
    expect(md).toContain('PROSE B');
  });

  it('renders failed runs with errorMessage and still preserves raw output', () => {
    const inputs = {
      ...baseInputs,
      runA: {
        ...runAOk,
        status: 'failed' as const,
        errorMessage: 'parse failed: bad shape',
        relationships: [],
      },
    };
    const md = renderIntentUpdateArtifact(inputs);
    expect(md).toContain('Status: failed');
    expect(md).toContain('Error: parse failed: bad shape');
    expect(md).toContain('## 10. Raw Output A');
  });

  it('does NOT include the original Employer Raw Situation outside the Original Employer Raw Situation section', () => {
    // Stage 3 §10 forbids duplicating the original
    // situation. The verbatim text is allowed in section 1
    // and is the basis of the model prompt, but it must
    // not appear a second time as a leaked fixture.
    const md = renderIntentUpdateArtifact(baseInputs);
    const firstIdx = md.indexOf(EMPLOYER_RAW_SITUATION);
    const lastIdx = md.lastIndexOf(EMPLOYER_RAW_SITUATION);
    expect(firstIdx).toBeGreaterThan(-1);
    expect(lastIdx).toBe(firstIdx);
  });

  it('writeIntentUpdateArtifact writes a file under artifacts/recruiting-poc/ with expected content', () => {
    const tmp = mkdtempSync(join(tmpdir(), 'intent-update-art-'));
    const origCwd = process.cwd();
    try {
      process.chdir(tmp);
      const path = writeIntentUpdateArtifact(baseInputs);
      const body = readFileSync(path, 'utf-8');
      expect(body).toContain('## 1. Original Employer Raw Situation');
      expect(body).toContain('## 8. Deterministic Relationship-Space Diff');
      expect(body).toContain('## 9. Runtime Metadata');
      expect(body).toContain('## 10. Raw Output A');
      expect(body).toContain('## 11. Raw Output B');
    } finally {
      process.chdir(origCwd);
      rmSync(tmp, { recursive: true, force: true });
    }
  });
});
