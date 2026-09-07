import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { mkdtempSync, rmSync, writeFileSync, readFileSync, existsSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import {
  readFailedArtifactRawStdout,
  recoverStage1Run,
} from '../../../matching/recruiting-poc/recover.js';

// Unit tests for the Stage 1 recovery path. The recovery
// re-parses the raw stdout that a previously-failed run saved
// into its `## Raw output (debug)` section, using the (fixed)
// parser. It does NOT call Hermes.

function writeFailedArtifact(
  dir: string,
  rawStdout: string,
  extraMeta: ReadonlyArray<string> = [],
): string {
  const filePath = join(dir, 'failed-stage1.md');
  const meta = [
    '- status: failed',
    '- durationMs: 999',
    '- errorMessage: parseHermesOutput: no parseable JSON object found in stdout',
    ...extraMeta,
  ].join('\n');
  const body = [
    '# Semantic Native Recruiting POC v0 — Full-Pool Relationship Discovery Baseline',
    '## Run Metadata',
    meta,
    '',
    '## Raw output (debug)',
    '```',
    rawStdout,
    '```',
    '',
  ].join('\n');
  writeFileSync(filePath, body, 'utf-8');
  return filePath;
}

const SAMPLE_OBJECT = {
  summary: 'Sample Stage 1 output with one extra brace',
  relationships: [
    {
      candidateId: 'C01',
      judgment: 'worth_exploring' as const,
      analysis: 'C01 owned a Kafka cluster.',
      evidence: ['C01: "I owned the Kafka cluster."'],
      unknowns: ['C01 cluster size not known.'],
      nextStep: 'Ask C01 about a recent outage.',
    },
    {
      candidateId: 'C02',
      judgment: 'uncertain' as const,
      analysis: 'C02 is a strong SRE.',
      evidence: ['C02: "I do incident command."'],
      unknowns: ['Whether C02 can ramp on Kafka.'],
      nextStep: 'Probe C02 on Kafka learning path.',
    },
  ],
};

describe('recruiting-poc/recover — readFailedArtifactRawStdout', () => {
  it('extracts the verbatim raw stdout between the section heading and the closing fence', () => {
    const tmp = mkdtempSync(join(tmpdir(), 'recover-read-'));
    try {
      const rawStdout = 'Prose line.\nProse line 2.\n{"a":1}\n';
      const filePath = writeFailedArtifact(tmp, rawStdout);
      const extracted = readFailedArtifactRawStdout(filePath);
      expect(extracted).toBe(rawStdout);
    } finally {
      rmSync(tmp, { recursive: true, force: true });
    }
  });

  it('throws when the artifact has no Raw output section', () => {
    const tmp = mkdtempSync(join(tmpdir(), 'recover-read-'));
    try {
      const filePath = join(tmp, 'no-debug.md');
      writeFileSync(filePath, '# header\n## Run Metadata\n- status: failed\n', 'utf-8');
      expect(() => readFailedArtifactRawStdout(filePath)).toThrowError(/no "## Raw output \(debug\)" section/);
    } finally {
      rmSync(tmp, { recursive: true, force: true });
    }
  });

  it('throws when the Raw output section has no opening code fence', () => {
    const tmp = mkdtempSync(join(tmpdir(), 'recover-read-'));
    try {
      const filePath = join(tmp, 'no-fence.md');
      writeFileSync(filePath, '## Raw output (debug)\njust text, no fence\n', 'utf-8');
      expect(() => readFailedArtifactRawStdout(filePath)).toThrowError(/no opening code fence/);
    } finally {
      rmSync(tmp, { recursive: true, force: true });
    }
  });

  it('throws when the Raw output section has no closing code fence', () => {
    const tmp = mkdtempSync(join(tmpdir(), 'recover-read-'));
    try {
      const filePath = join(tmp, 'unclosed.md');
      writeFileSync(filePath, '## Raw output (debug)\n```\nstill going...\n', 'utf-8');
      expect(() => readFailedArtifactRawStdout(filePath)).toThrowError(/no closing code fence/);
    } finally {
      rmSync(tmp, { recursive: true, force: true });
    }
  });
});

describe('recruiting-poc/recover — recoverStage1Run (synthetic fixture)', () => {
  let tmp: string;
  let origCwd: string;
  beforeAll(() => {
    tmp = mkdtempSync(join(tmpdir(), 'recover-run-'));
    origCwd = process.cwd();
    process.chdir(tmp);
  });
  afterAll(() => {
    process.chdir(origCwd);
    rmSync(tmp, { recursive: true, force: true });
  });

  it('recovers a balanced JSON object that has one extra trailing } (the Stage 1 failure pattern)', () => {
    const obj = SAMPLE_OBJECT;
    const json = JSON.stringify(obj);
    const rawStdout = `Prose.\nProse 2.\n${json}}\n`;
    const filePath = writeFailedArtifact(tmp, rawStdout);
    const outcome = recoverStage1Run(filePath);
    expect(outcome.status).toBe('succeeded');
    expect(outcome.errorMessage).toBeNull();
    expect(outcome.parsed).not.toBeNull();
    expect(outcome.parsed?.summary).toBe(obj.summary);
    expect(outcome.parsed?.relationships).toHaveLength(2);
    const ids = outcome.parsed?.relationships.map((r) => r.candidateId) ?? [];
    expect(ids).toEqual(['C01', 'C02']);
    const judgments = outcome.parsed?.relationships.map((r) => r.judgment) ?? [];
    expect(judgments).toEqual(['worth_exploring', 'uncertain']);
    expect(existsSync(outcome.recoveredArtifactPath)).toBe(true);
  });

  it('recovers a balanced JSON object that has multiple extra trailing }s', () => {
    const obj = { ...SAMPLE_OBJECT, relationships: [SAMPLE_OBJECT.relationships[0]!] };
    const json = JSON.stringify(obj);
    const rawStdout = `${json}}}}\n`;
    const filePath = writeFailedArtifact(tmp, rawStdout);
    const outcome = recoverStage1Run(filePath);
    expect(outcome.status).toBe('succeeded');
    expect(outcome.parsed?.relationships).toHaveLength(1);
  });

  it('writes the recovered artifact under artifacts/recruiting-poc/ with a .recovered suffix and a Recovery Note section', () => {
    const obj = SAMPLE_OBJECT;
    const json = JSON.stringify(obj);
    const rawStdout = `${json}}\n`;
    const filePath = writeFailedArtifact(tmp, rawStdout);
    const outcome = recoverStage1Run(filePath);
    const body = readFileSync(outcome.recoveredArtifactPath, 'utf-8');
    expect(body).toContain('## Recovery Note');
    expect(body).toContain('Source:** original Stage 1 oracle run. No new LLM invocation.');
    expect(body).toContain(`source: ${resolve(filePath)}`);
    expect(outcome.recoveredArtifactPath).toMatch(/_recruiting-poc-discovery\.recovered\.md$/);
  });

  it('writes a failed-recovery artifact when the source stdout still cannot be parsed', () => {
    const rawStdout = 'This is not JSON at all.\n``` broken ```\n';
    const filePath = writeFailedArtifact(tmp, rawStdout);
    const outcome = recoverStage1Run(filePath);
    expect(outcome.status).toBe('failed');
    expect(outcome.parsed).toBeNull();
    expect(outcome.errorMessage).toMatch(/no parseable JSON/);
    expect(existsSync(outcome.recoveredArtifactPath)).toBe(true);
    const body = readFileSync(outcome.recoveredArtifactPath, 'utf-8');
    expect(body).toContain('## Recovery Note');
    expect(body).toContain('status: failed');
    expect(body).toMatch(/errorMessage: .*no parseable JSON/);
  });
});

describe('recruiting-poc/recover — recoverStage1Run (real Stage 1 artifact, if present)', () => {
  // Integration test: if the original Stage 1 oracle run's
  // failed artifact exists on disk, run the recovery against
  // it and verify the parsed structured result.
  const REAL_ARTIFACT = resolve(
    process.cwd(),
    'artifacts/recruiting-poc/2026-09-06T18-15-44-562Z_recruiting-poc-discovery.md',
  );
  const hasRealArtifact = existsSync(REAL_ARTIFACT);

  it.runIf(hasRealArtifact)(
    'recovers the original 6 relationships from the Stage 1 oracle raw stdout',
    () => {
      const tmp = mkdtempSync(join(tmpdir(), 'recover-real-'));
      const origCwd = process.cwd();
      try {
        process.chdir(tmp);
        const outcome = recoverStage1Run(REAL_ARTIFACT);
        expect(outcome.status).toBe('succeeded');
        const parsed = outcome.parsed;
        expect(parsed).not.toBeNull();
        expect(parsed?.relationships).toHaveLength(6);
        const ids = (parsed?.relationships ?? []).map((r) => r.candidateId).sort();
        expect(ids).toEqual(['C01', 'C02', 'C03', 'C07', 'C08', 'C09']);
        const judgments = new Map(
          (parsed?.relationships ?? []).map((r) => [r.candidateId, r.judgment]),
        );
        expect(judgments.get('C01')).toBe('worth_exploring');
        expect(judgments.get('C02')).toBe('worth_exploring');
        expect(judgments.get('C03')).toBe('worth_exploring');
        expect(judgments.get('C09')).toBe('worth_exploring');
        expect(judgments.get('C07')).toBe('uncertain');
        expect(judgments.get('C08')).toBe('uncertain');
      } finally {
        process.chdir(origCwd);
        rmSync(tmp, { recursive: true, force: true });
      }
    },
  );
});
