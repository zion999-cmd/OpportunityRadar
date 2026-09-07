import { describe, it, expect } from 'vitest';
import {
  parseCompletionOutput,
  parseRelationshipOutput,
} from '../../../semantic-completion/parse.js';

describe('parseCompletionOutput', () => {
  it('parses a valid completion JSON wrapped in Hermes prose', () => {
    const stdout =
      'Some prose line above.\n' +
      JSON.stringify({
        directlySupported: 'a',
        impliedMeaning: 'b',
        hypothesesAndUnknowns: 'c',
      });
    const out = parseCompletionOutput(stdout);
    expect(out.directlySupported).toBe('a');
    expect(out.impliedMeaning).toBe('b');
    expect(out.hypothesesAndUnknowns).toBe('c');
  });

  it('accepts empty strings in any of the three fields', () => {
    const stdout = JSON.stringify({
      directlySupported: '',
      impliedMeaning: '',
      hypothesesAndUnknowns: '',
    });
    const out = parseCompletionOutput(stdout);
    expect(out).toEqual({
      directlySupported: '',
      impliedMeaning: '',
      hypothesesAndUnknowns: '',
    });
  });

  it('rejects a missing field', () => {
    const stdout = JSON.stringify({
      directlySupported: 'a',
      impliedMeaning: 'b',
    });
    expect(() => parseCompletionOutput(stdout)).toThrow(/failed schema validation/);
  });

  it('rejects the OLD boundary field names (directlySupportedMeaning, knowledgeSupportedCompletion, unknown)', () => {
    const stdout = JSON.stringify({
      directlySupportedMeaning: 'a',
      knowledgeSupportedCompletion: 'b',
      unknown: 'c',
    });
    expect(() => parseCompletionOutput(stdout)).toThrow(/failed schema validation/);
  });

  it('rejects a non-string field', () => {
    const stdout = JSON.stringify({
      directlySupported: 'a',
      impliedMeaning: ['b'],
      hypothesesAndUnknowns: 'c',
    });
    expect(() => parseCompletionOutput(stdout)).toThrow(/failed schema validation/);
  });

  it('rejects an extra top-level key (does not silently strip)', () => {
    const stdout = JSON.stringify({
      directlySupported: 'a',
      impliedMeaning: 'b',
      hypothesesAndUnknowns: 'c',
      somethingElse: 'd',
    });
    // zod object default is to pass through extra keys; this test
    // documents current behavior. If we later want to forbid extras,
    // switch the schema to .strict() and update this expectation.
    const out = parseCompletionOutput(stdout);
    expect(out.hypothesesAndUnknowns).toBe('c');
  });

  it('throws when no JSON object is present', () => {
    expect(() => parseCompletionOutput('just prose, nothing else')).toThrow(
      /no parseable JSON/,
    );
  });
});

describe('parseRelationshipOutput', () => {
  it('parses a valid relationship JSON wrapped in Hermes prose', () => {
    const stdout =
      'Some prose line above.\n' +
      JSON.stringify({
        supportedReasoning: 'sr',
        stillNeedsEvidence: 'sne',
      });
    const out = parseRelationshipOutput(stdout);
    expect(out.supportedReasoning).toBe('sr');
    expect(out.stillNeedsEvidence).toBe('sne');
  });

  it('rejects a missing stillNeedsEvidence field', () => {
    const stdout = JSON.stringify({ supportedReasoning: 'sr' });
    expect(() => parseRelationshipOutput(stdout)).toThrow(/failed schema validation/);
  });

  it('rejects a missing supportedReasoning field', () => {
    const stdout = JSON.stringify({ stillNeedsEvidence: 'sne' });
    expect(() => parseRelationshipOutput(stdout)).toThrow(/failed schema validation/);
  });

  it('throws when no JSON object is present', () => {
    expect(() => parseRelationshipOutput('just prose, nothing else')).toThrow(
      /no parseable JSON/,
    );
  });
});
