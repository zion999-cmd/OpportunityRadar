import { describe, it, expect } from 'vitest';
import { renderMatchingArtifact, type ArtifactInputs } from '../../../matching/artifact.js';

const base: ArtifactInputs = {
  caseId: 'A',
  label: 'label',
  notes: 'notes',
  recruitingMaterial: 'recruit text',
  applyingMaterial: 'apply text',
  status: 'succeeded',
  judgment: {
    judgment: 'worth_exploring',
    analysis: 'why',
    evidence: ['e1', '[INFERRED] e2'],
    unknowns: ['u1'],
    nextStep: 'do X',
  },
  errorMessage: null,
  durationMs: 1234,
  stdout: '',
};

describe('renderMatchingArtifact', () => {
  it('includes recruiting and applying material verbatim in code fences', () => {
    const md = renderMatchingArtifact(base);
    expect(md).toContain('recruit text');
    expect(md).toContain('apply text');
  });

  it('renders judgment fields in the required order', () => {
    const md = renderMatchingArtifact(base);
    const idxAnalysis = md.indexOf('analysis');
    const idxEvidence = md.indexOf('evidence');
    const idxUnknowns = md.indexOf('unknowns');
    const idxNext = md.indexOf('nextStep');
    expect(idxAnalysis).toBeGreaterThan(0);
    expect(idxEvidence).toBeGreaterThan(idxAnalysis);
    expect(idxUnknowns).toBeGreaterThan(idxEvidence);
    expect(idxNext).toBeGreaterThan(idxUnknowns);
  });

  it('preserves evidence prefixes (e.g. [INFERRED]) without re-interpreting them', () => {
    const md = renderMatchingArtifact(base);
    expect(md).toContain('[INFERRED] e2');
  });

  it('emits _empty_ for empty evidence / unknowns arrays', () => {
    const md = renderMatchingArtifact({
      ...base,
      judgment: { ...base.judgment!, evidence: [], unknowns: [] },
    });
    expect(md).toMatch(/evidence[\s\S]*_empty_/);
    expect(md).toMatch(/unknowns[\s\S]*_empty_/);
  });

  it('handles a failed run with no judgment and surfaces the error message', () => {
    const md = renderMatchingArtifact({
      ...base,
      status: 'failed',
      judgment: null,
      errorMessage: 'parseMatchingOutput: no parseable JSON object found in stdout (147 chars)',
      stdout: 'no JSON here, just prose',
    });
    expect(md).toContain('status: failed');
    expect(md).toContain('parseMatchingOutput');
    expect(md).toContain('No judgment was produced');
    expect(md).toContain('Raw output (debug)');
    expect(md).toContain('no JSON here');
  });
});
