import { describe, it, expect } from 'vitest';
import { buildMatchingPrompt } from '../../../matching/prompt.js';
import { caseA, allCases } from '../../../matching/cases.js';

describe('buildMatchingPrompt', () => {
  it('embeds the recruiting and applying material verbatim', () => {
    const prompt = buildMatchingPrompt(caseA);
    expect(prompt).toContain(caseA.recruitingMaterial);
    expect(prompt).toContain(caseA.applyingMaterial);
  });

  it('mentions the three judgment values', () => {
    const prompt = buildMatchingPrompt(caseA);
    expect(prompt).toContain('worth_exploring');
    expect(prompt).toContain('uncertain');
    expect(prompt).toContain('unlikely');
  });

  it('demands the JSON on the last line', () => {
    const prompt = buildMatchingPrompt(caseA);
    expect(prompt).toMatch(/last line/i);
  });

  it('renders all four cases without truncation', () => {
    for (const c of allCases) {
      const prompt = buildMatchingPrompt(c);
      expect(prompt).toContain(c.recruitingMaterial);
      expect(prompt).toContain(c.applyingMaterial);
    }
  });
});
