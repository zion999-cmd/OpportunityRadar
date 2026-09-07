import { describe, it, expect } from 'vitest';
import { parseMatchingOutput } from '../../../matching/parse.js';

describe('parseMatchingOutput', () => {
  it('parses a valid matching JSON wrapped in Hermes prose', () => {
    const stdout =
      'Some prose from the model.\n' +
      '{"judgment":"worth_exploring","analysis":"because","evidence":["a","b"],"unknowns":["u"],"nextStep":"call"}';
    const out = parseMatchingOutput(stdout);
    expect(out.judgment).toBe('worth_exploring');
    expect(out.analysis).toBe('because');
    expect(out.evidence).toEqual(['a', 'b']);
    expect(out.unknowns).toEqual(['u']);
    expect(out.nextStep).toBe('call');
  });

  it('accepts every enum value', () => {
    for (const j of ['worth_exploring', 'uncertain', 'unlikely'] as const) {
      const stdout = `{"judgment":"${j}","analysis":"","evidence":[],"unknowns":[],"nextStep":""}`;
      const out = parseMatchingOutput(stdout);
      expect(out.judgment).toBe(j);
    }
  });

  it('rejects an unknown judgment value', () => {
    const stdout = '{"judgment":"maybe","analysis":"","evidence":[],"unknowns":[],"nextStep":""}';
    expect(() => parseMatchingOutput(stdout)).toThrow(/failed schema validation/);
  });

  it('rejects a missing nextStep', () => {
    const stdout = '{"judgment":"worth_exploring","analysis":"","evidence":[],"unknowns":[]}';
    expect(() => parseMatchingOutput(stdout)).toThrow(/failed schema validation/);
  });

  it('throws when no JSON object is present', () => {
    expect(() => parseMatchingOutput('just prose, nothing else')).toThrow(/no parseable JSON/);
  });

  it('extracts the last balanced JSON object from a multi-line block', () => {
    const stdout =
      'first object: {"a":1}\n' +
      'second object: {"judgment":"unlikely","analysis":"x","evidence":[],"unknowns":[],"nextStep":"y"}';
    const out = parseMatchingOutput(stdout);
    expect(out.judgment).toBe('unlikely');
    expect(out.analysis).toBe('x');
  });
});
