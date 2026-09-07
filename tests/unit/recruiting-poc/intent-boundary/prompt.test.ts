import { describe, it, expect } from 'vitest';
import { buildIntentBoundaryPrompt } from '../../../../matching/recruiting-poc/intent-boundary/prompt.js';
import {
  EMPLOYER_RAW_SITUATION,
  CANDIDATE_POOL,
} from '../../../../matching/recruiting-poc/cases.js';
import type { FullPoolDiscoveredRelationship } from '../../../../matching/recruiting-poc/parse.js';

const sampleRelationships: ReadonlyArray<FullPoolDiscoveredRelationship> = [
  {
    candidateId: 'C03',
    judgment: 'worth_exploring',
    analysis: 'C03 actually owned a Kafka deployment at the scale implied.',
    evidence: ['C03: "I owned the Kafka deployment that handled order events."'],
    unknowns: ['Whether C03 has run a cluster at the scale implied by the employer situation.'],
    nextStep: 'Ask C03 for the most recent postmortem.',
  },
  {
    candidateId: 'C10',
    judgment: 'uncertain',
    analysis: 'C10 is a strong SRE but has no streaming experience.',
    evidence: ['C10: "I do incident command, write postmortems."'],
    unknowns: ['Whether C10 can ramp on the streaming layer in a reasonable time.'],
    nextStep: 'Probe C10 on how they would learn the streaming layer in week 1.',
  },
];

describe('recruiting-poc/intent-boundary/prompt', () => {
  it('embeds the Employer Raw Situation verbatim (Chinese, no translation)', () => {
    const prompt = buildIntentBoundaryPrompt({ discoveredRelationships: sampleRelationships });
    expect(prompt).toContain(EMPLOYER_RAW_SITUATION);
    expect(prompt).toContain('Kafka 这块现在没人真正 owner');
  });

  it('embeds all 20 candidate IDs and a representative head of each raw experience', () => {
    const prompt = buildIntentBoundaryPrompt({ discoveredRelationships: sampleRelationships });
    for (const c of CANDIDATE_POOL) {
      expect(prompt).toContain(`[${c.id}]`);
      expect(prompt).toContain(c.rawExperience.slice(0, 80));
    }
  });

  it('embeds the Stage 1 discovered relationships with their 5-field shape', () => {
    const prompt = buildIntentBoundaryPrompt({ discoveredRelationships: sampleRelationships });
    expect(prompt).toContain('[C03] worth_exploring');
    expect(prompt).toContain('[C10] uncertain');
    expect(prompt).toContain('analysis: C03 actually owned a Kafka deployment at the scale implied.');
    expect(prompt).toContain('unknowns:');
  });

  it('instructs the model to return ONE question only', () => {
    const prompt = buildIntentBoundaryPrompt({ discoveredRelationships: sampleRelationships });
    expect(prompt).toMatch(/SINGLE most important unresolved question/);
    expect(prompt).toMatch(/ONE question only/);
  });

  it('specifies the JSON-on-last-line output contract', () => {
    const prompt = buildIntentBoundaryPrompt({ discoveredRelationships: sampleRelationships });
    expect(prompt).toContain('On the LAST line of your reply, output a single JSON object');
    expect(prompt).toContain('The last line MUST be the JSON object and nothing else on that line');
  });

  it('specifies the Intent Boundary output schema (question / whyItMatters / affectedRelationships / evidence)', () => {
    const prompt = buildIntentBoundaryPrompt({ discoveredRelationships: sampleRelationships });
    expect(prompt).toContain('"question"');
    expect(prompt).toContain('"whyItMatters"');
    expect(prompt).toContain('"affectedRelationships"');
    expect(prompt).toContain('"evidence"');
    expect(prompt).toContain('"candidateId"');
    expect(prompt).toContain('"ifAnswerA"');
    expect(prompt).toContain('"ifAnswerB"');
  });

  it('forbids form-field / HR-intake questions', () => {
    const prompt = buildIntentBoundaryPrompt({ discoveredRelationships: sampleRelationships });
    expect(prompt).toMatch(/form field/);
    expect(prompt).toMatch(/HR intake/);
  });

  it('forbids re-judging the candidates (the question is about the employer, not the pool)', () => {
    const prompt = buildIntentBoundaryPrompt({ discoveredRelationships: sampleRelationships });
    expect(prompt).toMatch(/re-judge the candidates/);
  });

  // Anti-leakage (Stage 2 §B5). The prompt must NOT name or
  // hint at the specific research observations or the
  // candidates the human reader thinks might flip. We assert
  // on the INSTRUCTIONS section only — the Employer Raw
  // Situation and the Candidate Raw Experiences are the
  // input the model is being asked to analyze, not prompt
  // content that could "leak" a hint. The instructions are
  // everything from the start of the prompt up to
  // "--- Employer Raw Situation ---".
  //
  // We forbid the specific research-observation tokens
  // (Kafka / RabbitMQ / Pulsar / the literal phrase "hard
  // constraint"). We do NOT forbid the generic concept
  // "proxy" (a model needs to know what a proxy is to find
  // a real one), nor "constraint" used as a generic term.
  it('does NOT leak Kafka / RabbitMQ / Pulsar / the phrase "hard constraint" in the INSTRUCTIONS section (Stage 2 §B5)', () => {
    const prompt = buildIntentBoundaryPrompt({ discoveredRelationships: sampleRelationships });
    const instructionsSection = prompt.split('--- Employer Raw Situation ---')[0] ?? '';
    const forbiddenTokens = [
      'Kafka', 'RabbitMQ', 'Pulsar', 'kafka', 'rabbitmq', 'pulsar',
      'hard constraint', 'messaging bus',
    ];
    for (const t of forbiddenTokens) {
      expect(instructionsSection, `forbidden token: ${t}`).not.toContain(t);
    }
  });

  it('does NOT name the specific candidates the spec flags as "sensitive" (Stage 2 §B5)', () => {
    const prompt = buildIntentBoundaryPrompt({ discoveredRelationships: sampleRelationships });
    // The spec flags C07, C08, C10, C11, C12, C15. The
    // CANDIDATE_POOL is in the prompt by definition (all 20
    // raw experiences), so the prompt DOES contain C07 etc.
    // as candidate IDs. What the prompt must NOT do is
    // mention these candidates in the INSTRUCTIONS or in
    // a "hint" about which judgment might flip. We assert by
    // checking that the prompt does not contain a sentence
    // saying something like "C07 / C08 / C10 / C11 / C12 /
    // C15 should change" or "consider whether C07 is
    // actually a fit". The simplest robust check: split the
    // prompt at "--- Employer Raw Situation ---" (the
    // candidate raw experiences come after) and assert the
    // INSTRUCTIONS section does not name any of the
    // sensitive candidates by their ID, and does not say
    // "C07" / "C08" etc. as a free-standing identifier
    // outside the `### C07` raw-experience section.
    const instructionsSection = prompt.split('--- Employer Raw Situation ---')[0] ?? '';
    for (const id of ['C07', 'C08', 'C10', 'C11', 'C12', 'C15']) {
      expect(instructionsSection, `leakage: ${id} mentioned in instructions`).not.toContain(id);
    }
  });
});
