import { describe, it, expect } from 'vitest';
import { buildIntentUpdatePrompt } from '../../../../matching/recruiting-poc/intent-update/prompt.js';
import {
  ANSWER_A_VERBATIM,
  ANSWER_B_VERBATIM,
} from '../../../../matching/recruiting-poc/intent-update/answers.js';
import {
  EMPLOYER_RAW_SITUATION,
  CANDIDATE_POOL,
} from '../../../../matching/recruiting-poc/cases.js';

describe('recruiting-poc/intent-update/prompt', () => {
  it('embeds the Original Employer Raw Situation verbatim', () => {
    const prompt = buildIntentUpdatePrompt('A');
    expect(prompt).toContain(EMPLOYER_RAW_SITUATION);
    expect(prompt).toContain('Kafka 这块现在没人真正 owner');
  });

  it('embeds all 20 candidate IDs and a representative head of each raw experience', () => {
    const prompt = buildIntentUpdatePrompt('A');
    for (const c of CANDIDATE_POOL) {
      expect(prompt).toContain(`[${c.id}]`);
      expect(prompt).toContain(c.rawExperience.slice(0, 80));
    }
  });

  it('embeds the chosen answer as a new "Additional Raw Intent Evidence" section', () => {
    const promptA = buildIntentUpdatePrompt('A');
    const promptB = buildIntentUpdatePrompt('B');
    expect(promptA).toContain('--- Additional Raw Intent Evidence ---');
    expect(promptA).toContain(ANSWER_A_VERBATIM);
    expect(promptB).toContain(ANSWER_B_VERBATIM);
  });

  it('instructs the model to treat the additional evidence as clarification, not filters', () => {
    const prompt = buildIntentUpdatePrompt('A');
    // Stage 3 §4 verbatim addition.
    expect(prompt).toContain(
      'The employer has provided additional raw intent evidence after the original situation. Treat it as clarification of what they actually need. Do not convert it into filters or fields. Reconsider the candidate relationships from the raw evidence.',
    );
  });

  it('A prompt does NOT contain the B answer text (no cross-contamination)', () => {
    const promptA = buildIntentUpdatePrompt('A');
    expect(promptA, 'A prompt must not contain the B answer').not.toContain(ANSWER_B_VERBATIM);
  });

  it('B prompt does NOT contain the A answer text (no cross-contamination)', () => {
    const promptB = buildIntentUpdatePrompt('B');
    expect(promptB, 'B prompt must not contain the A answer').not.toContain(ANSWER_A_VERBATIM);
  });

  it('does NOT tell the model which candidates should be promoted or demoted (Stage 3 §4 anti-leakage)', () => {
    const prompt = buildIntentUpdatePrompt('A');
    const instructionsSection = prompt.split('--- Employer Raw Situation ---')[0] ?? '';
    // The spec names C01, C02, C03, C07, C08, C09, C10, C11,
    // C12, C15 as "sensitive" candidate IDs. CANDIDATE_POOL
    // is in the prompt by definition (all 20 raw experiences
    // are embedded), so the candidate raw-experience
    // sections contain C07 etc. as IDs. The INSTRUCTIONS
    // section must not name any sensitive ID.
    for (const id of ['C01', 'C02', 'C03', 'C07', 'C08', 'C09', 'C10', 'C11', 'C12', 'C15']) {
      expect(instructionsSection, `leakage: ${id} mentioned in instructions`).not.toContain(id);
    }
  });

  it('forbids schema/filter/tag/taxonomy/keyword-search conversion in the instructions (Stage 3 §10)', () => {
    const prompt = buildIntentUpdatePrompt('A');
    const instructionsSection = prompt.split('--- Employer Raw Situation ---')[0] ?? '';
    const forbiddenTokens = [
      'embedding', 'vector', 'cosine', 'BM25', 'TF-IDF',
      'keyword search', 'skills[]', 'requiredYears', 'job schema',
      'tags', 'categories', 'taxonomy', 'filter condition',
      'kafkaRequired', 'brokerExperience', 'hardConstraint',
    ];
    for (const t of forbiddenTokens) {
      expect(instructionsSection, `forbidden token: ${t}`).not.toContain(t);
    }
  });

  it('preserves the Stage 1 output contract (5-field per-relationship shape + judgment enum)', () => {
    const prompt = buildIntentUpdatePrompt('A');
    expect(prompt).toContain('"summary"');
    expect(prompt).toContain('"relationships"');
    expect(prompt).toContain('"candidateId"');
    expect(prompt).toContain('"judgment"');
    expect(prompt).toContain('"analysis"');
    expect(prompt).toContain('"evidence"');
    expect(prompt).toContain('"unknowns"');
    expect(prompt).toContain('"nextStep"');
    expect(prompt).toContain('"worth_exploring" | "uncertain"');
    expect(prompt).toContain('Do NOT produce an "unlikely" judgment');
    expect(prompt).toContain('On the LAST line of your reply, output a single JSON object');
  });

  it('extends the "evidence" key to allow quoting the additional raw intent evidence', () => {
    const prompt = buildIntentUpdatePrompt('A');
    expect(prompt).toMatch(/the candidate's raw experience AND\/OR the employer's raw situation AND\/OR the additional raw intent evidence/);
  });

  it('preserves the capability-transfer-does-not-imply-solution-transfer rule', () => {
    const prompt = buildIntentUpdatePrompt('A');
    expect(prompt).toContain('Capability transfer does not imply solution transfer');
  });
});
