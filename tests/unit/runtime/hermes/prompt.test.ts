import { describe, it, expect } from 'vitest';
import { buildHermesPrompt } from '../../../../runtime/hermes/prompt.js';

// Unit tests for the Hermes prompt builder. The prompt is the
// only place where Radar's neutral Goal is rendered into the
// textual shape Hermes consumes. A change to the prompt shape
// is a contract change for Hermes; these tests pin the current
// contract.

describe('buildHermesPrompt', () => {
  it('renders the question and market into a hermes-shaped prompt', () => {
    const prompt = buildHermesPrompt({
      id: 'goal-1',
      question: 'What AI funding rounds were announced recently in the US?',
      market: 'US',
      createdAt: '2026-09-03T10:00:00.000Z',
    });
    expect(prompt).toContain('Question: What AI funding rounds were announced recently in the US?');
    expect(prompt).toContain('Market: US');
    // No time window line when the field is absent.
    expect(prompt).not.toContain('Time window:');
    // No evidence interests line when the field is absent.
    expect(prompt).not.toContain('Evidence interests:');
  });

  it('includes the optional time window when provided', () => {
    const prompt = buildHermesPrompt({
      id: 'goal-1',
      question: 'q',
      market: 'US',
      timeWindow: 'last_30_days',
      createdAt: '2026-09-03T10:00:00.000Z',
    });
    expect(prompt).toContain('Time window: last_30_days');
  });

  it('includes the optional evidence interests when provided', () => {
    const prompt = buildHermesPrompt({
      id: 'goal-1',
      question: 'q',
      market: 'US',
      evidenceInterests: ['funding', 'acquisition'],
      createdAt: '2026-09-03T10:00:00.000Z',
    });
    expect(prompt).toContain('Evidence interests: funding, acquisition');
  });

  it('instructs Hermes to emit a JSON object on the LAST line', () => {
    const prompt = buildHermesPrompt({
      id: 'goal-1',
      question: 'q',
      market: 'US',
      createdAt: '2026-09-03T10:00:00.000Z',
    });
    // The output-requirements block names the JSON shape and
    // tells Hermes to put it on the last line with nothing after.
    expect(prompt).toMatch(/[Oo]n the LAST line/);
    // The three required top-level keys must be named in the
    // prompt so Hermes knows the expected shape. They appear
    // in the requirements block as bare identifiers.
    expect(prompt).toMatch(/\bsummary\b/);
    expect(prompt).toMatch(/\bsources\b/);
    expect(prompt).toMatch(/\bevidenceCandidates\b/);
  });
});
