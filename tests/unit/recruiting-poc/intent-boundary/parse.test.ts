import { describe, it, expect } from 'vitest';
import { parseIntentBoundaryOutput } from '../../../../matching/recruiting-poc/intent-boundary/parse.js';

const validOutput = {
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

describe('recruiting-poc/intent-boundary/parse', () => {
  it('parses a valid intent-boundary output', () => {
    const parsed = parseIntentBoundaryOutput(JSON.stringify(validOutput));
    expect(parsed.question).toContain('streaming');
    expect(parsed.whyItMatters).toContain('proxy');
    expect(parsed.affectedRelationships).toHaveLength(2);
    expect(parsed.affectedRelationships[0]!.candidateId).toBe('C03');
    expect(parsed.affectedRelationships[0]!.ifAnswerA).toContain('Remains worth_exploring');
    expect(parsed.affectedRelationships[0]!.ifAnswerB).toContain('drops to uncertain');
    expect(parsed.evidence).toHaveLength(2);
  });

  it('rejects output with no affected relationships (the question must shift at least one candidate)', () => {
    const out = { ...validOutput, affectedRelationships: [] };
    expect(() => parseIntentBoundaryOutput(JSON.stringify(out))).toThrow(/affectedRelationships/);
  });

  it('rejects output missing the question', () => {
    const out = { ...validOutput };
    delete (out as { question?: string }).question;
    expect(() => parseIntentBoundaryOutput(JSON.stringify(out))).toThrow(/question/);
  });

  it('rejects output missing the whyItMatters', () => {
    const out = { ...validOutput };
    delete (out as { whyItMatters?: string }).whyItMatters;
    expect(() => parseIntentBoundaryOutput(JSON.stringify(out))).toThrow(/whyItMatters/);
  });

  it('rejects affected relationship missing ifAnswerA', () => {
    const ar = { ...validOutput.affectedRelationships[0]! };
    delete (ar as { ifAnswerA?: string }).ifAnswerA;
    const out = { ...validOutput, affectedRelationships: [ar] };
    expect(() => parseIntentBoundaryOutput(JSON.stringify(out))).toThrow(/ifAnswerA/);
  });

  it('rejects affected relationship missing ifAnswerB', () => {
    const ar = { ...validOutput.affectedRelationships[0]! };
    delete (ar as { ifAnswerB?: string }).ifAnswerB;
    const out = { ...validOutput, affectedRelationships: [ar] };
    expect(() => parseIntentBoundaryOutput(JSON.stringify(out))).toThrow(/ifAnswerB/);
  });

  it('rejects affected relationship missing candidateId', () => {
    const ar = { ...validOutput.affectedRelationships[0]! };
    delete (ar as { candidateId?: string }).candidateId;
    const out = { ...validOutput, affectedRelationships: [ar] };
    expect(() => parseIntentBoundaryOutput(JSON.stringify(out))).toThrow(/candidateId/);
  });

  it('rejects non-array affectedRelationships', () => {
    const out = { ...validOutput, affectedRelationships: 'not an array' };
    expect(() => parseIntentBoundaryOutput(JSON.stringify(out))).toThrow();
  });

  it('extracts the JSON object when the model writes prose above it', () => {
    const prose = 'Here is the question I would ask...\n\n' + JSON.stringify(validOutput) + '\n';
    const parsed = parseIntentBoundaryOutput(prose);
    expect(parsed.question).toBe(validOutput.question);
  });

  it('rejects completely malformed stdout', () => {
    expect(() => parseIntentBoundaryOutput('this is not json at all')).toThrow();
  });
});
