import type { MatchingCase } from './cases.js';

// matching/prompt.ts — render a MatchingCase as a Hermes-shaped
// blind prompt.
//
// This module owns the *language* the model sees. It does NOT
// import from `runtime/hermes/*` (no Hermes name, no transport,
// no client) — it only knows how to assemble prose. The Hermes-
// specific call is made in `./run.ts`, which is the only place
// in `matching/` that knows there is a Hermes at all.
//
// The prompt:
//   1. Names the task: bilateral matching, three coarse verdicts.
//   2. Tells the model to look past surface keywords.
//   3. Names the output contract (the 5-field RelationJudgment)
//      and demands the JSON on the LAST line.
//   4. Embeds the case material verbatim under labeled separators.

export function buildMatchingPrompt(c: MatchingCase): string {
  return [
    'You are a reasoning engine for a bilateral matching experiment.',
    '',
    'You will receive two natural-language material blocks: one from the recruiting side, one from the applying side.',
    'Your job: decide whether there is a relationship worth exploring further, and explain your reasoning.',
    '',
    'Treat the two material blocks as documents. Do not reformat them into a schema.',
    'Look past surface keywords (job titles, technology names, certifications).',
    'Look at: situation, intent, demonstrated capability, working mode, constraint, and what is unknown.',
    '',
    'Pick exactly one judgment:',
    '  worth_exploring — there is a real reason for both sides to spend more time on each other',
    '  uncertain        — there is a possibility, but key facts are missing',
    '  unlikely         — looking past the keywords, the situations do not fit',
    '',
    'On the LAST line of your reply, output a single JSON object and nothing else on that line.',
    'The JSON object MUST have exactly these top-level keys:',
    '  "judgment"  : one of "worth_exploring" | "uncertain" | "unlikely"',
    '  "analysis"  : a short free-text paragraph explaining your judgment',
    '  "evidence"  : an array of short strings (pieces of evidence; you may prefix entries with [OBSERVED], [INFERRED], or [CONFLICT] if it helps, but you do not have to)',
    '  "unknowns"  : an array of short strings describing what you could not determine',
    '  "nextStep"  : a single short string describing one concrete next action',
    '',
    'You may write a brief summary above the JSON. The last line MUST be the JSON object and nothing else on that line.',
    'If you cannot determine anything, return the JSON with empty arrays. Do not invent facts.',
    '',
    `--- Notes for this case ---`,
    c.notes,
    '',
    '--- Recruiting material ---',
    c.recruitingMaterial,
    '',
    '--- Applying material ---',
    c.applyingMaterial,
  ].join('\n');
}
