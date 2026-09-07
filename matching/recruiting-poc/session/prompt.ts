import { CANDIDATE_POOL } from '../cases.js';
import { isBudgetExhausted, type SessionState } from './state.js';

// matching/recruiting-poc/session/prompt.ts —
// the runtime decision prompt for the Product Spine.
//
// Reuses the Stage 1 prompt structure (verifiable raw
// evidence in, JSON-on-last-line out). The differences:
//
//   1. The "employer raw situation" is the USER's input,
//      not the fixed Stage 1 fixture. The session's
//      rawSituation is whatever the user typed into the
//      CLI at startup.
//
//   2. The session maintains a Raw Intent Evidence timeline.
//      Each turn, the accumulated clarifications are
//      rendered as a t-numbered timeline so the model can
//      see what the user has already said.
//
//   3. The output schema is a discriminated union:
//
//         { action: "ask",      question, whyItMatters }
//         { action: "surface",  relationships[] }
//
//      "ask" is ONE question only (Stage 0 §4). "surface"
//      uses the existing 5-field relationship shape
//      (Stage 1 / Stage 3).
//
//   4. The session enforces the 2-ask budget at the
//      runtime level (Stage 0 §5). When the budget is
//      exhausted, the session calls buildForcedSurfacePrompt
//      instead of buildSessionPrompt, which has a stricter
//      schema (surface-only, no ask option).
//
// Anti-leakage: the prompt never names specific candidate
// IDs, never mentions Kafka / RabbitMQ / Pulsar as a hint,
// never asks for filters / tags / scores / rankings.

export interface BuildSessionPromptOptions {
  readonly forceSurface: boolean;
}

export function buildSessionPrompt(
  state: SessionState,
  options: BuildSessionPromptOptions = { forceSurface: false },
): string {
  const candidateSection = CANDIDATE_POOL
    .map((c) => `[${c.id}]\n${c.rawExperience}`)
    .join('\n\n');

  const evidenceTimeline =
    state.rawIntentEvidence.length === 0
      ? '_None yet._'
      : state.rawIntentEvidence
          .map((e, i) => `t${i + 1} (after system question ${i + 1}):\n${e}`)
          .join('\n\n');

  const intro = options.forceSurface
    ? 'You are the runtime of a recruiting assistant in its FINAL turn. The session has reached its question budget (2 ask-answer cycles). You MUST surface the most actionable relationships now. Any remaining unknowns go into each relationship\'s `unknowns` field; do not ask another question.'
    : 'You are the runtime of a recruiting assistant. You observe the user\'s raw situation, accumulated raw intent evidence (a timeline of the user\'s natural-language clarifications), and a fixed candidate pool. After each turn you decide: ask ONE question, or surface the most actionable relationships. The decision is yours.';

  const outputSchema = options.forceSurface
    ? [
        'On the LAST line of your reply, output a single JSON object and nothing else on that line. The JSON MUST have exactly these top-level keys:',
        '  "action":        the literal string "surface"',
        '  "relationships": an array of objects with the 5-field shape:',
        '      "candidateId"  : the candidate\'s "C##" identifier from the pool below',
        '      "judgment"     : one of "worth_exploring" | "uncertain"',
        '      "analysis"     : a short free-text paragraph explaining this specific judgment',
        '      "evidence"     : an array of short strings, each traceable to the candidate\'s raw experience AND/OR the user\'s raw situation AND/OR the raw intent evidence timeline',
        '      "unknowns"     : an array of short strings describing what you could not determine that materially affects the relationship',
        '      "nextStep"     : a single short string describing ONE concrete next action',
      ].join('\n')
    : [
        'On the LAST line of your reply, output a single JSON object and nothing else on that line. The JSON MUST have exactly these top-level keys:',
        '  "action":   one of "ask" or "surface"',
        '  if action == "ask":',
        '    "question":     the single most important unresolved intent question (one sentence, phrased as a question)',
        '    "whyItMatters": one or two sentences on what would change if this were answered',
        '  if action == "surface":',
        '    "relationships": an array of objects with the 5-field shape:',
        '      "candidateId"  : the candidate\'s "C##" identifier from the pool below',
        '      "judgment"     : one of "worth_exploring" | "uncertain"',
        '      "analysis"     : a short free-text paragraph explaining this specific judgment',
        '      "evidence"     : an array of short strings, each traceable to the candidate\'s raw experience AND/OR the user\'s raw situation AND/OR the raw intent evidence timeline',
        '      "unknowns"     : an array of short strings describing what you could not determine that materially affects the relationship',
        '      "nextStep"     : a single short string describing ONE concrete next action',
      ].join('\n');

  return [
    intro,
    '',
    'You will receive:',
    '- 1 User Raw Situation (the user\'s original situation, verbatim)',
    `- ${state.rawIntentEvidence.length} entries in the Raw Intent Evidence timeline (each is a verbatim user clarification, append-only)`,
    `- ${CANDIDATE_POOL.length} Candidate Raw Experiences (each candidate\'s past experience, in English, natural language)`,
    '',
    'Critical rules:',
    '- Read everything as raw evidence. Do not convert into fields, filters, tags, scores, or schema values.',
    '- When you ask, ask ONE question that, if answered, would materially change the relationships you would surface.',
    '- When you surface, surface only the relationships that have real action value given the current evidence.',
    '- Capability transfer does not imply solution transfer. Do not assume that an intervention that worked in one past situation should be copied into the user\'s situation.',
    '- Do not invent evidence. The user\'s situation and clarifications are the only user-side evidence; the candidate raw experiences are the only candidate-side evidence.',
    '- This is discovery, not exhaustive classification. Do NOT produce an "unlikely" judgment for non-surfaced candidates.',
    options.forceSurface
      ? '- This is the final turn. You MUST surface. Do not ask another question.'
      : '- When the user has answered enough questions, surface. When the evidence is still ambiguous on a dimension that would change the surfaced set, ask. The decision is yours.',
    '',
    outputSchema,
    '',
    'You may write a short explanation above the JSON. The last line MUST be the JSON object and nothing else on that line.',
    '',
    '--- User Raw Situation ---',
    '',
    state.rawSituation,
    '',
    `--- Raw Intent Evidence Timeline (${state.rawIntentEvidence.length}) ---`,
    '',
    evidenceTimeline,
    '',
    `--- Candidate Raw Experiences (${CANDIDATE_POOL.length}) ---`,
    '',
    candidateSection,
  ].join('\n');
}

/**
 * Convenience: build the forced-surface prompt for a
 * session whose ask budget is exhausted. Equivalent to
 * `buildSessionPrompt(state, { forceSurface: true })`.
 */
export function buildForcedSurfacePrompt(state: SessionState): string {
  // If for any reason this is called when the budget is
  // not exhausted, we still force surface — that is the
  // session's policy. The model is told clearly.
  void isBudgetExhausted(state);
  return buildSessionPrompt(state, { forceSurface: true });
}
