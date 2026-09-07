import { describe, it, expect } from 'vitest';
import {
  parseRuntimeDecision,
  parseForcedSurfaceDecision,
} from '../../../../matching/recruiting-poc/session/parse.js';

const validAsk = {
  action: 'ask',
  question: 'Is the streaming layer a hard requirement, or is it a proxy for a different intent?',
  whyItMatters: 'If it is a proxy, the candidate set widens.',
};

const validSurface = {
  action: 'surface',
  relationships: [
    {
      candidateId: 'C03',
      judgment: 'worth_exploring',
      analysis: 'C03 actually owned a Kafka deployment at scale.',
      evidence: ['C03: "I owned the Kafka deployment"'],
      unknowns: ['C03 scale not specified.'],
      nextStep: 'Ask C03 for the most recent postmortem.',
    },
  ],
};

const validForcedSurface = {
  relationships: [
    {
      candidateId: 'C07',
      judgment: 'worth_exploring',
      analysis: 'C07 had 2 years of critical-fintech cluster ownership.',
      evidence: ['C07: "I owned a RabbitMQ cluster for a fintech startup"'],
      unknowns: ['Whether C07 can ramp on Kafka in 2-3 months.'],
      nextStep: 'Probe C07 on their Kafka ramp plan.',
    },
  ],
};

describe('recruiting-poc/session/parse — runtime decision (ask or surface)', () => {
  it('parses a valid ask decision', () => {
    const parsed = parseRuntimeDecision(JSON.stringify(validAsk));
    expect(parsed.action).toBe('ask');
    if (parsed.action === 'ask') {
      expect(parsed.question).toContain('streaming');
      expect(parsed.whyItMatters).toContain('proxy');
    }
  });

  it('parses a valid surface decision', () => {
    const parsed = parseRuntimeDecision(JSON.stringify(validSurface));
    expect(parsed.action).toBe('surface');
    if (parsed.action === 'surface') {
      expect(parsed.relationships).toHaveLength(1);
      expect(parsed.relationships[0]!.candidateId).toBe('C03');
    }
  });

  it('rejects an ask decision missing the question', () => {
    const out = { ...validAsk };
    delete (out as { question?: string }).question;
    expect(() => parseRuntimeDecision(JSON.stringify(out))).toThrow(/question/);
  });

  it('rejects an ask decision missing the whyItMatters', () => {
    const out = { ...validAsk };
    delete (out as { whyItMatters?: string }).whyItMatters;
    expect(() => parseRuntimeDecision(JSON.stringify(out))).toThrow(/whyItMatters/);
  });

  it('rejects a surface decision with an empty relationships array is allowed (0..N)', () => {
    const out = { action: 'surface', relationships: [] };
    const parsed = parseRuntimeDecision(JSON.stringify(out));
    if (parsed.action === 'surface') {
      expect(parsed.relationships).toHaveLength(0);
    }
  });

  it('rejects a surface decision with relationships missing the 5-field shape', () => {
    const out = {
      action: 'surface',
      relationships: [{ candidateId: 'C03' }],
    };
    expect(() => parseRuntimeDecision(JSON.stringify(out))).toThrow();
  });

  it('rejects "unlikely" as a relationship judgment', () => {
    const out = {
      action: 'surface',
      relationships: [{ ...validSurface.relationships[0]!, judgment: 'unlikely' }],
    };
    expect(() => parseRuntimeDecision(JSON.stringify(out))).toThrow();
  });

  it('rejects an unknown action value', () => {
    const out = { action: 'maybe', question: 'x', whyItMatters: 'y' };
    expect(() => parseRuntimeDecision(JSON.stringify(out))).toThrow();
  });

  it('extracts the JSON object when the model writes prose above it', () => {
    const prose = 'I think...\n\n' + JSON.stringify(validAsk) + '\n';
    const parsed = parseRuntimeDecision(prose);
    expect(parsed.action).toBe('ask');
  });

  it('rejects completely malformed stdout', () => {
    expect(() => parseRuntimeDecision('not json at all')).toThrow();
  });
});

describe('recruiting-poc/session/parse — forced surface decision', () => {
  it('parses a valid forced surface decision (no action field)', () => {
    const parsed = parseForcedSurfaceDecision(JSON.stringify(validForcedSurface));
    expect(parsed.action).toBe('surface');
    expect(parsed.relationships).toHaveLength(1);
    expect(parsed.relationships[0]!.candidateId).toBe('C07');
  });

  it('parses a forced surface decision with action: "surface" (the shape the prompt emits)', () => {
    const out = { action: 'surface', ...validForcedSurface };
    const parsed = parseForcedSurfaceDecision(JSON.stringify(out));
    expect(parsed.action).toBe('surface');
    expect(parsed.relationships).toHaveLength(1);
    expect(parsed.relationships[0]!.candidateId).toBe('C07');
  });

  it('parses an envelope-less forced surface decision (backward compat)', () => {
    const parsed = parseForcedSurfaceDecision(JSON.stringify(validForcedSurface));
    expect(parsed.action).toBe('surface');
    expect(parsed.relationships).toHaveLength(1);
    expect(parsed.relationships[0]!.candidateId).toBe('C07');
  });

  it('rejects a forced surface decision with action: "ask" (the model is not allowed to ask)', () => {
    const out = { action: 'ask', ...validForcedSurface };
    expect(() => parseForcedSurfaceDecision(JSON.stringify(out))).toThrow();
  });

  it('rejects a forced surface decision with a non-surface action value', () => {
    const out = { action: 'maybe', ...validForcedSurface };
    expect(() => parseForcedSurfaceDecision(JSON.stringify(out))).toThrow();
  });

  it('rejects a forced surface decision with arbitrary unknown keys (still strict)', () => {
    const out = { ...validForcedSurface, secret: 'x' };
    expect(() => parseForcedSurfaceDecision(JSON.stringify(out))).toThrow();
  });

  it('rejects a forced surface decision missing relationships', () => {
    const out = {};
    expect(() => parseForcedSurfaceDecision(JSON.stringify(out))).toThrow();
  });

  it('rejects a forced surface decision with a relationship missing the 5-field shape', () => {
    const out = { relationships: [{ candidateId: 'C07' }] };
    expect(() => parseForcedSurfaceDecision(JSON.stringify(out))).toThrow();
  });
});
