import { describe, it, expect } from 'vitest';
import {
  renderDiscoveryArtifact,
  type ArtifactInputs,
} from '../../../../matching/discovery/artifact.js';

const recruiting = [
  { id: 'R1', material: 'recruit text alpha' },
  { id: 'R2', material: 'recruit text bravo' },
];
const applying = [
  { id: 'A1', material: 'apply text alpha' },
  { id: 'A2', material: 'apply text bravo' },
];

const baseSucceeded: ArtifactInputs = {
  recruitingPool: recruiting,
  applyingPool: applying,
  status: 'succeeded',
  summary: 'overall summary text',
  relationships: [
    {
      recruitingId: 'R1',
      applyingId: 'A1',
      judgment: 'worth_exploring',
      analysis: 'why it is worth it',
      evidence: ['[OBSERVED] e1', '[INFERRED] e2'],
      unknowns: ['u1'],
      nextStep: 'do X',
    },
  ],
  errorMessage: null,
  durationMs: 1234,
  stdout: '',
};

describe('renderDiscoveryArtifact', () => {
  it('includes both pools verbatim in code fences', () => {
    const md = renderDiscoveryArtifact(baseSucceeded);
    expect(md).toContain('recruit text alpha');
    expect(md).toContain('recruit text bravo');
    expect(md).toContain('apply text alpha');
    expect(md).toContain('apply text bravo');
  });

  it('renders recruiting pool with the actual IDs as section headers', () => {
    const md = renderDiscoveryArtifact(baseSucceeded);
    expect(md).toContain('### R1');
    expect(md).toContain('### R2');
  });

  it('renders applying pool with the actual IDs as section headers', () => {
    const md = renderDiscoveryArtifact(baseSucceeded);
    expect(md).toContain('### A1');
    expect(md).toContain('### A2');
  });

  it('renders the Agent Summary verbatim', () => {
    const md = renderDiscoveryArtifact(baseSucceeded);
    expect(md).toContain('## Agent Summary');
    expect(md).toContain('overall summary text');
  });

  it('renders each relationship with all 5 fields and the relationship IDs', () => {
    const md = renderDiscoveryArtifact(baseSucceeded);
    expect(md).toContain('### R1 ↔ A1 — worth_exploring');
    expect(md).toContain('**analysis**');
    expect(md).toContain('why it is worth it');
    expect(md).toContain('**evidence**');
    expect(md).toContain('[OBSERVED] e1');
    expect(md).toContain('[INFERRED] e2');
    expect(md).toContain('**unknowns**');
    expect(md).toContain('u1');
    expect(md).toContain('**nextStep**');
    expect(md).toContain('do X');
  });

  it('shows the relationship count in the section header', () => {
    const md = renderDiscoveryArtifact(baseSucceeded);
    expect(md).toContain('## Discovered Relationships (1)');
  });

  it('reports pool sizes in metadata', () => {
    const md = renderDiscoveryArtifact(baseSucceeded);
    expect(md).toContain('recruitingPoolSize: 2');
    expect(md).toContain('applyingPoolSize: 2');
  });

  it('reports succeeded status and duration in metadata', () => {
    const md = renderDiscoveryArtifact(baseSucceeded);
    expect(md).toContain('status: succeeded');
    expect(md).toContain('durationMs: 1234');
  });

  it('handles 0 relationships (model found nothing)', () => {
    const md = renderDiscoveryArtifact({ ...baseSucceeded, relationships: [] });
    expect(md).toContain('## Discovered Relationships (0)');
    expect(md).toContain('_No relationships were proposed by the Agent._');
  });

  it('handles a failed run with no summary or relationships and includes raw stdout', () => {
    const md = renderDiscoveryArtifact({
      ...baseSucceeded,
      status: 'failed',
      summary: null,
      relationships: [],
      errorMessage:
        'parseDiscoveryOutput: no parseable JSON object found in stdout (147 chars)',
      stdout: 'no JSON here, just Hermes prose',
    });
    expect(md).toContain('status: failed');
    expect(md).toContain('errorMessage: parseDiscoveryOutput');
    expect(md).toContain('_No summary returned by the Agent._');
    expect(md).toContain('_No relationships were proposed by the Agent._');
    expect(md).toContain('## Raw output (debug)');
    expect(md).toContain('no JSON here, just Hermes prose');
  });

  it('handles 3 relationships with mixed judgments', () => {
    const md = renderDiscoveryArtifact({
      ...baseSucceeded,
      relationships: [
        {
          recruitingId: 'R1',
          applyingId: 'A1',
          judgment: 'worth_exploring',
          analysis: 'a',
          evidence: ['e'],
          unknowns: [],
          nextStep: 'n1',
        },
        {
          recruitingId: 'R2',
          applyingId: 'A2',
          judgment: 'uncertain',
          analysis: 'b',
          evidence: [],
          unknowns: ['q'],
          nextStep: 'n2',
        },
        {
          recruitingId: 'R1',
          applyingId: 'A2',
          judgment: 'unlikely',
          analysis: 'c',
          evidence: [],
          unknowns: [],
          nextStep: 'n3',
        },
      ],
    });
    expect(md).toContain('## Discovered Relationships (3)');
    expect(md).toContain('### R1 ↔ A1 — worth_exploring');
    expect(md).toContain('### R2 ↔ A2 — uncertain');
    expect(md).toContain('### R1 ↔ A2 — unlikely');
  });
});
