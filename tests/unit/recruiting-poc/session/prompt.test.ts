import { describe, it, expect } from 'vitest';
import {
  buildSessionPrompt,
  buildForcedSurfacePrompt,
} from '../../../../matching/recruiting-poc/session/prompt.js';
import { createInitialState, appendIntentEvidence, incrementAskCount } from '../../../../matching/recruiting-poc/session/state.js';
import { CANDIDATE_POOL } from '../../../../matching/recruiting-poc/cases.js';

describe('recruiting-poc/session/prompt — decision mode (default)', () => {
  it('embeds the user raw situation verbatim', () => {
    const state = createInitialState('我现在的 Kafka 没人 owner。最近出了几次事故。');
    const prompt = buildSessionPrompt(state);
    expect(prompt).toContain('我现在的 Kafka 没人 owner。最近出了几次事故。');
  });

  it('embeds all 20 candidate IDs in the candidate pool section', () => {
    const state = createInitialState('situation');
    const prompt = buildSessionPrompt(state);
    for (const c of CANDIDATE_POOL) {
      expect(prompt).toContain(`[${c.id}]`);
      expect(prompt).toContain(c.rawExperience.slice(0, 80));
    }
  });

  it('renders the Raw Intent Evidence Timeline as t-numbered entries when there are answers', () => {
    let state = createInitialState('situation');
    state = appendIntentEvidence(state, 'first clarification');
    state = appendIntentEvidence(state, 'second clarification');
    const prompt = buildSessionPrompt(state);
    expect(prompt).toContain('--- Raw Intent Evidence Timeline (2) ---');
    expect(prompt).toContain('t1 (after system question 1):');
    expect(prompt).toContain('first clarification');
    expect(prompt).toContain('t2 (after system question 2):');
    expect(prompt).toContain('second clarification');
  });

  it('renders "_None yet._" when the timeline is empty', () => {
    const state = createInitialState('situation');
    const prompt = buildSessionPrompt(state);
    expect(prompt).toContain('--- Raw Intent Evidence Timeline (0) ---');
    expect(prompt).toContain('_None yet._');
  });

  it('instructs the runtime to ask ONE question or surface (no fixed workflow)', () => {
    const prompt = buildSessionPrompt(createInitialState('situation'));
    expect(prompt).toContain('ask ONE question, or surface the most actionable relationships');
    expect(prompt).toContain('The decision is yours.');
  });

  it('instructs the runtime NOT to convert into fields, filters, tags, or scores', () => {
    const prompt = buildSessionPrompt(createInitialState('situation'));
    expect(prompt).toContain('Do not convert into fields, filters, tags, scores, or schema values.');
  });

  it('does NOT mention any sensitive candidate ID in the INSTRUCTIONS section (anti-leakage)', () => {
    const prompt = buildSessionPrompt(createInitialState('situation'));
    const instructionsSection = prompt.split('--- User Raw Situation ---')[0] ?? '';
    for (const id of ['C01', 'C02', 'C03', 'C07', 'C08', 'C09', 'C10', 'C11', 'C12', 'C15']) {
      expect(instructionsSection, `leakage: ${id}`).not.toContain(id);
    }
  });

  it('forbids "unlikely" as a relationship judgment (consistent with Stage 1)', () => {
    const prompt = buildSessionPrompt(createInitialState('situation'));
    expect(prompt).toContain('Do NOT produce an "unlikely" judgment');
  });

  it('preserves the 5-field relationship shape and the judgment enum', () => {
    const prompt = buildSessionPrompt(createInitialState('situation'));
    expect(prompt).toContain('"candidateId"');
    expect(prompt).toContain('"judgment"');
    expect(prompt).toContain('"analysis"');
    expect(prompt).toContain('"evidence"');
    expect(prompt).toContain('"unknowns"');
    expect(prompt).toContain('"nextStep"');
    expect(prompt).toContain('"worth_exploring" | "uncertain"');
  });
});

describe('recruiting-poc/session/prompt — forced surface mode (budget exhausted)', () => {
  it('is selected when askCount >= 2', () => {
    let state = createInitialState('situation');
    state = appendIntentEvidence(state, 'a1');
    state = appendIntentEvidence(state, 'a2');
    state = incrementAskCount(state);
    state = incrementAskCount(state);
    const prompt = buildForcedSurfacePrompt(state);
    expect(prompt).toContain('FINAL turn');
    expect(prompt).toContain('You MUST surface');
    expect(prompt).toContain('"action":        the literal string "surface"');
  });

  it('does NOT include the "ask" branch in the output schema', () => {
    let state = createInitialState('situation');
    state = incrementAskCount(state);
    state = incrementAskCount(state);
    const prompt = buildForcedSurfacePrompt(state);
    // The forced surface prompt must not advertise the ask
    // option. The schema is surface-only.
    const schemaSection = prompt.split('On the LAST line')[1] ?? '';
    expect(schemaSection).not.toContain('"question"');
    expect(schemaSection).not.toContain('"whyItMatters"');
  });

  it('preserves the user raw situation and timeline verbatim', () => {
    let state = createInitialState('my situation');
    state = appendIntentEvidence(state, 'clarification one');
    state = appendIntentEvidence(state, 'clarification two');
    state = incrementAskCount(state);
    state = incrementAskCount(state);
    const prompt = buildForcedSurfacePrompt(state);
    expect(prompt).toContain('my situation');
    expect(prompt).toContain('clarification one');
    expect(prompt).toContain('clarification two');
  });
});
