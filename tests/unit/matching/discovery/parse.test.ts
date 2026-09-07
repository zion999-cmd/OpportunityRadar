import { describe, it, expect } from 'vitest';
import { parseDiscoveryOutput } from '../../../../matching/discovery/parse.js';

describe('parseDiscoveryOutput', () => {
  it('parses a valid discovery JSON wrapped in Hermes prose', () => {
    const stdout =
      'Some prose line above.\n' +
      JSON.stringify({
        summary: 'overview of the two pools',
        relationships: [
          {
            recruitingId: 'R1',
            applyingId: 'A1',
            judgment: 'worth_exploring',
            analysis: 'because',
            evidence: ['a', 'b'],
            unknowns: ['u'],
            nextStep: 'call',
          },
        ],
      });
    const out = parseDiscoveryOutput(stdout);
    expect(out.summary).toBe('overview of the two pools');
    expect(out.relationships).toHaveLength(1);
    const first = out.relationships[0]!;
    expect(first.recruitingId).toBe('R1');
    expect(first.applyingId).toBe('A1');
    expect(first.judgment).toBe('worth_exploring');
    expect(first.analysis).toBe('because');
    expect(first.evidence).toEqual(['a', 'b']);
    expect(first.unknowns).toEqual(['u']);
    expect(first.nextStep).toBe('call');
  });

  it('accepts an empty relationships array', () => {
    const stdout = JSON.stringify({ summary: 'nothing to propose', relationships: [] });
    const out = parseDiscoveryOutput(stdout);
    expect(out.summary).toBe('nothing to propose');
    expect(out.relationships).toEqual([]);
  });

  it('accepts all three judgment values', () => {
    const stdout = JSON.stringify({
      summary: 's',
      relationships: [
        {
          recruitingId: 'R1',
          applyingId: 'A1',
          judgment: 'worth_exploring',
          analysis: '',
          evidence: [],
          unknowns: [],
          nextStep: '',
        },
        {
          recruitingId: 'R2',
          applyingId: 'A2',
          judgment: 'uncertain',
          analysis: '',
          evidence: [],
          unknowns: [],
          nextStep: '',
        },
        {
          recruitingId: 'R3',
          applyingId: 'A3',
          judgment: 'unlikely',
          analysis: '',
          evidence: [],
          unknowns: [],
          nextStep: '',
        },
      ],
    });
    const out = parseDiscoveryOutput(stdout);
    expect(out.relationships.map((r) => r.judgment)).toEqual([
      'worth_exploring',
      'uncertain',
      'unlikely',
    ]);
  });

  it('rejects an unknown judgment value', () => {
    const stdout = JSON.stringify({
      summary: 's',
      relationships: [
        {
          recruitingId: 'R1',
          applyingId: 'A1',
          judgment: 'maybe',
          analysis: '',
          evidence: [],
          unknowns: [],
          nextStep: '',
        },
      ],
    });
    expect(() => parseDiscoveryOutput(stdout)).toThrow(/failed schema validation/);
  });

  it('rejects a relationship missing nextStep', () => {
    const stdout = JSON.stringify({
      summary: 's',
      relationships: [
        {
          recruitingId: 'R1',
          applyingId: 'A1',
          judgment: 'worth_exploring',
          analysis: '',
          evidence: [],
          unknowns: [],
        },
      ],
    });
    expect(() => parseDiscoveryOutput(stdout)).toThrow(/failed schema validation/);
  });

  it('rejects a top-level object missing summary', () => {
    const stdout = JSON.stringify({ relationships: [] });
    expect(() => parseDiscoveryOutput(stdout)).toThrow(/failed schema validation/);
  });

  it('throws when no JSON object is present', () => {
    expect(() => parseDiscoveryOutput('just prose, nothing else')).toThrow(
      /no parseable JSON/,
    );
  });

  it('throws on a balanced-brace text fragment with no JSON', () => {
    // Triggers the "no parseable JSON" path of extractJsonObject,
    // not the schema path, even though braces appear in the text.
    expect(() => parseDiscoveryOutput('hello { world } done')).toThrow(
      /no parseable JSON/,
    );
  });
});
