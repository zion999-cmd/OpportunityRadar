import { describe, it, expect } from 'vitest';
import { parseFullPoolDiscoveryOutput } from '../../../../matching/recruiting-poc/intent-update/parse.js';

// Stage 3 re-uses the Stage 1 parser. The output shape is
// identical. The smoke tests below are the ones that
// matter for the Stage 3 contract; full coverage is in
// tests/unit/recruiting-poc/parse.test.ts.

const validOutput = {
  summary: 'With Answer A, the Kafka-native candidates dominate.',
  relationships: [
    {
      candidateId: 'C01',
      judgment: 'worth_exploring' as const,
      analysis: 'C01 owned a 200+-service Kafka cluster with end-to-end incident ownership.',
      evidence: [
        'C01: "I was the only person on-call for a Kafka cluster that served 200+ downstream services"',
        'Employer (Answer A): "Kafka production depth 是现在真实的硬约束"',
      ],
      unknowns: ['C01 has not run a cluster at the implied scale.'],
      nextStep: 'Ask C01 for the most recent postmortem.',
    },
    {
      candidateId: 'C10',
      judgment: 'uncertain' as const,
      analysis: 'C10 is a strong SRE but no streaming depth.',
      evidence: ['C10: "I do incident command, write postmortems."'],
      unknowns: ['Whether C10 can ramp on Kafka in a reasonable time under Answer A.'],
      nextStep: 'Probe C10 on how they would learn the streaming layer in week 1.',
    },
  ],
};

describe('recruiting-poc/intent-update/parse — re-exports Stage 1 parser', () => {
  it('parses a valid full-pool discovery output', () => {
    const parsed = parseFullPoolDiscoveryOutput(JSON.stringify(validOutput));
    expect(parsed.summary).toBe(validOutput.summary);
    expect(parsed.relationships).toHaveLength(2);
  });

  it('accepts an empty relationships array (0..N allowed)', () => {
    const out = { summary: 'No matches.', relationships: [] };
    const parsed = parseFullPoolDiscoveryOutput(JSON.stringify(out));
    expect(parsed.relationships).toHaveLength(0);
  });

  it('rejects "unlikely" as a judgment (regression for the discovery semantic)', () => {
    const out = {
      summary: '...',
      relationships: [{ ...validOutput.relationships[0]!, judgment: 'unlikely' }],
    };
    expect(() => parseFullPoolDiscoveryOutput(JSON.stringify(out))).toThrow(/failed schema validation/);
  });

  it('extracts the JSON object when the model writes prose above it', () => {
    const prose = 'Some prose...\n\n' + JSON.stringify(validOutput) + '\n';
    const parsed = parseFullPoolDiscoveryOutput(prose);
    expect(parsed.summary).toBe(validOutput.summary);
  });

  it('rejects completely malformed stdout', () => {
    expect(() => parseFullPoolDiscoveryOutput('not json at all')).toThrow();
  });
});
