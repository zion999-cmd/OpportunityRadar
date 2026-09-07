import { describe, it, expect } from 'vitest';
import { buildFullPoolDiscoveryPrompt } from '../../../matching/recruiting-poc/prompt.js';
import {
  EMPLOYER_RAW_SITUATION,
  CANDIDATE_POOL,
} from '../../../matching/recruiting-poc/cases.js';

describe('recruiting-poc/prompt', () => {
  it('embeds the Employer Raw Situation verbatim (Chinese, no translation)', () => {
    const prompt = buildFullPoolDiscoveryPrompt();
    expect(prompt).toContain(EMPLOYER_RAW_SITUATION);
    expect(prompt).toContain('Kafka 这块现在没人真正 owner');
  });

  it('embeds all 20 candidate IDs and a representative head of each raw experience', () => {
    const prompt = buildFullPoolDiscoveryPrompt();
    for (const c of CANDIDATE_POOL) {
      expect(prompt).toContain(`[${c.id}]`);
      expect(prompt).toContain(c.rawExperience.slice(0, 80));
    }
  });

  it('states the core question verbatim (Stage 1 §4)', () => {
    const prompt = buildFullPoolDiscoveryPrompt();
    expect(prompt).toContain(
      'Based on the raw evidence, which candidates, if any, have actually demonstrated capabilities that could meaningfully help change the employer\'s current situation?',
    );
  });

  it('lists the two allowed judgment values (worth_exploring | uncertain)', () => {
    const prompt = buildFullPoolDiscoveryPrompt();
    expect(prompt).toContain('"worth_exploring" | "uncertain"');
  });

  it('judgment enum line is exactly "worth_exploring" | "uncertain" (no "unlikely")', () => {
    const prompt = buildFullPoolDiscoveryPrompt();
    // The judgment enum line is the only place where the enum
    // is specified. The whole prompt MAY mention "unlikely" in
    // an instruction ("Do NOT produce an 'unlikely' judgment
    // for non-surfaced candidates"), so we assert on the enum
    // line specifically, not on the whole prompt.
    const enumLine = prompt
      .split('\n')
      .find((l) => l.includes('one of "worth_exploring" | "uncertain"'));
    expect(enumLine).toBeDefined();
    expect(enumLine).not.toContain('unlikely');
    // And the rule is present:
    expect(prompt).toContain('Do NOT produce an "unlikely" judgment');
  });

  it('forbids ranking, similarity, score, and embedding/vector recall (Stage 1 §9)', () => {
    const prompt = buildFullPoolDiscoveryPrompt();
    // The prompt must not leak any of these anti-patterns.
    const forbidden = [
      'embedding', 'vector', 'cosine', 'BM25', 'TF-IDF', 'tf-idf',
      'similarity score', 'match score', 'rank ', 'ranking',
      'keyword search', 'skills[]', 'requiredYears', 'job schema',
      'tags', 'categories', 'filter condition',
    ];
    for (const f of forbidden) {
      expect(prompt.toLowerCase(), `forbidden token: ${f}`).not.toContain(f.toLowerCase());
    }
  });

  it('includes the capability-transfer-does-not-imply-solution-transfer rule', () => {
    const prompt = buildFullPoolDiscoveryPrompt();
    expect(prompt).toContain('Capability transfer does not imply solution transfer');
  });

  it('includes the "do not invent missing evidence" rule', () => {
    const prompt = buildFullPoolDiscoveryPrompt();
    expect(prompt).toContain('Do not invent missing evidence');
  });

  it('includes the "do not pre-translate the employer situation" rule', () => {
    const prompt = buildFullPoolDiscoveryPrompt();
    expect(prompt).toContain('Do not pre-translate or paraphrase the employer situation');
  });

  it('specifies the JSON-on-last-line output contract', () => {
    const prompt = buildFullPoolDiscoveryPrompt();
    expect(prompt).toContain('On the LAST line of your reply, output a single JSON object');
    expect(prompt).toContain('The last line MUST be the JSON object and nothing else on that line');
  });

  it('specifies the 5-field per-relationship shape (analysis / evidence / unknowns / nextStep + candidateId + judgment)', () => {
    const prompt = buildFullPoolDiscoveryPrompt();
    expect(prompt).toContain('"candidateId"');
    expect(prompt).toContain('"judgment"');
    expect(prompt).toContain('"analysis"');
    expect(prompt).toContain('"evidence"');
    expect(prompt).toContain('"unknowns"');
    expect(prompt).toContain('"nextStep"');
  });
});
