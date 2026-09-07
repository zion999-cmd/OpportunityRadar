import { describe, it, expect } from 'vitest';
import { parseFullPoolDiscoveryOutput } from '../../../matching/recruiting-poc/parse.js';

const validSummary = 'Two strong Kafka owners stood out, plus one transferable SRE.';

const validRelationship = {
  candidateId: 'C03',
  judgment: 'worth_exploring',
  analysis: 'C03 actually owned a Kafka deployment, did on-call, did postmortems.',
  evidence: [
    'C03: "I owned the Kafka deployment that handled order events."',
    'C03: "I did the postmortems"',
    'Employer: "Kafka 这块现在没人真正 owner"',
  ],
  unknowns: [
    'C03 has not run a cluster at the scale implied by the employer situation.',
  ],
  nextStep: 'Ask C03 for the most recent postmortem and walk through which runbook sections are still missing.',
};

const validOutput = {
  summary: validSummary,
  relationships: [validRelationship],
};

describe('recruiting-poc/parse', () => {
  it('parses a valid full-pool discovery output', () => {
    const parsed = parseFullPoolDiscoveryOutput(JSON.stringify(validOutput));
    expect(parsed.summary).toBe(validSummary);
    expect(parsed.relationships).toHaveLength(1);
    const r = parsed.relationships[0]!;
    expect(r.candidateId).toBe('C03');
    expect(r.judgment).toBe('worth_exploring');
    expect(r.analysis).toContain('Kafka');
    expect(r.evidence).toHaveLength(3);
    expect(r.unknowns).toHaveLength(1);
    expect(r.nextStep).toContain('postmortem');
  });

  it('accepts an empty relationships array (0..N is allowed)', () => {
    const out = { summary: 'No strong signal in this pool.', relationships: [] };
    const parsed = parseFullPoolDiscoveryOutput(JSON.stringify(out));
    expect(parsed.relationships).toHaveLength(0);
  });

  it('accepts both judgment values (worth_exploring | uncertain)', () => {
    const out = {
      summary: 'mixed',
      relationships: [
        { ...validRelationship, judgment: 'worth_exploring' },
        { ...validRelationship, candidateId: 'C10', judgment: 'uncertain' },
      ],
    };
    const parsed = parseFullPoolDiscoveryOutput(JSON.stringify(out));
    expect(parsed.relationships.map((r) => r.judgment)).toEqual(['worth_exploring', 'uncertain']);
  });

  it('rejects "unlikely" as a judgment value (regression guard for Stage 1 §5)', () => {
    const out = {
      summary: '...',
      relationships: [{ ...validRelationship, judgment: 'unlikely' }],
    };
    expect(() => parseFullPoolDiscoveryOutput(JSON.stringify(out))).toThrow(/failed schema validation/);
  });

  it('rejects missing summary', () => {
    const out = { relationships: [validRelationship] };
    expect(() => parseFullPoolDiscoveryOutput(JSON.stringify(out))).toThrow(/failed schema validation/);
  });

  it('rejects missing relationships', () => {
    const out = { summary: 'x' };
    expect(() => parseFullPoolDiscoveryOutput(JSON.stringify(out))).toThrow(/failed schema validation/);
  });

  it('rejects missing candidateId', () => {
    const rel = { ...validRelationship };
    delete (rel as { candidateId?: string }).candidateId;
    const out = { summary: 'x', relationships: [rel] };
    expect(() => parseFullPoolDiscoveryOutput(JSON.stringify(out))).toThrow(/failed schema validation/);
  });

  it('rejects missing analysis', () => {
    const rel = { ...validRelationship };
    delete (rel as { analysis?: string }).analysis;
    const out = { summary: 'x', relationships: [rel] };
    expect(() => parseFullPoolDiscoveryOutput(JSON.stringify(out))).toThrow(/failed schema validation/);
  });

  it('rejects missing evidence', () => {
    const rel = { ...validRelationship };
    delete (rel as { evidence?: string[] }).evidence;
    const out = { summary: 'x', relationships: [rel] };
    expect(() => parseFullPoolDiscoveryOutput(JSON.stringify(out))).toThrow(/failed schema validation/);
  });

  it('rejects missing unknowns', () => {
    const rel = { ...validRelationship };
    delete (rel as { unknowns?: string[] }).unknowns;
    const out = { summary: 'x', relationships: [rel] };
    expect(() => parseFullPoolDiscoveryOutput(JSON.stringify(out))).toThrow(/failed schema validation/);
  });

  it('rejects missing nextStep', () => {
    const rel = { ...validRelationship };
    delete (rel as { nextStep?: string }).nextStep;
    const out = { summary: 'x', relationships: [rel] };
    expect(() => parseFullPoolDiscoveryOutput(JSON.stringify(out))).toThrow(/failed schema validation/);
  });

  it('rejects evidence that is not an array', () => {
    const rel = { ...validRelationship, evidence: 'not an array' };
    const out = { summary: 'x', relationships: [rel] };
    expect(() => parseFullPoolDiscoveryOutput(JSON.stringify(out))).toThrow(/failed schema validation/);
  });

  it('extracts the JSON object when the model writes prose above it', () => {
    const prose = 'Here is what I saw...\n\n' + JSON.stringify(validOutput) + '\n';
    const parsed = parseFullPoolDiscoveryOutput(prose);
    expect(parsed.summary).toBe(validSummary);
  });

  it('rejects completely malformed stdout', () => {
    expect(() => parseFullPoolDiscoveryOutput('this is not json at all')).toThrow();
  });
});
