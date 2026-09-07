import { EMPLOYER_RAW_SITUATION, CANDIDATE_POOL } from '../cases.js';
import { ANSWER_TEXT, type IntentUpdateAnswer } from './answers.js';

// matching/recruiting-poc/intent-update/prompt.ts —
// Stage 3 full-pool discovery prompt, parameterized by which
// counterfactual answer is appended as raw intent evidence.
//
// Reuses the Stage 1 prompt structure verbatim (persona,
// inputs description, core question, critical rules, output
// format). The ONLY additions are:
//
//   1. One new sentence in the INSTRUCTIONS section
//      (Stage 3 §4, verbatim):
//
//         "The employer has provided additional raw intent
//          evidence after the original situation. Treat it
//          as clarification of what they actually need. Do
//          not convert it into filters or fields.
//          Reconsider the candidate relationships from the
//          raw evidence."
//
//   2. A new section between "Employer Raw Situation" and
//      "Candidate Raw Experiences" titled
//      "--- Additional Raw Intent Evidence ---" that
//      contains the verbatim answer text.
//
// Stage 1 prompt is NOT modified. The Stage 3 prompt is a
// self-contained sibling that mirrors Stage 1's structure
// exactly and adds the two pieces above. This keeps Stage 1
// and Stage 2 untouched (Stage 3 §10).
//
// Anti-leakage (Stage 3 §4):
//   - The prompt does NOT name the candidate IDs that the
//     human reader thinks should be promoted or demoted
//     (C01, C02, C03, C07, C08, C09, C10, C11, C12, C15).
//   - The prompt does NOT tell the model "Kafka candidates
//     should..." or "C07 should be promoted under answer B".
//     The model is responsible for reading the answer text
//     and re-deriving which candidates fit.
//   - The "evidence" key in the output schema is extended
//     to allow quotes from the additional raw intent
//     evidence in addition to the original Employer
//     Situation and candidate raw experiences. This is a
//     schema hint, not a content leak.

export function buildIntentUpdatePrompt(answer: IntentUpdateAnswer): string {
  const candidateSection = CANDIDATE_POOL
    .map((c) => `[${c.id}]\n${c.rawExperience}`)
    .join('\n\n');

  const answerText = ANSWER_TEXT[answer];

  return [
    'You are a full-pool relationship discovery engine for a recruiting experiment.',
    '',
    'You will receive:',
    '- 1 Employer Raw Situation (the company\'s real situation, in Chinese, verbatim)',
    `- ${CANDIDATE_POOL.length} Candidate Raw Experiences (each candidate\'s past experience, in English, natural language)`,
    '- 1 Additional Raw Intent Evidence (the employer\'s clarification, in Chinese, verbatim)',
    '',
    'Core question:',
    '',
    '  Based on the raw evidence, which candidates, if any, have actually demonstrated capabilities that could meaningfully help change the employer\'s current situation?',
    '',
    'The employer has provided additional raw intent evidence after the original situation. Treat it as clarification of what they actually need. Do not convert it into filters or fields. Reconsider the candidate relationships from the raw evidence.',
    '',
    'Critical rules:',
    '- Do not judge primarily by shared technologies, titles, years of experience, or vocabulary.',
    '- Look at what each candidate has actually encountered, taken responsibility for, changed, and what outcomes followed.',
    '- Capability transfer does not imply solution transfer. Do not assume that an intervention that worked in one past situation should be copied into the employer\'s situation.',
    '- Do not invent missing evidence. If a claim is not in the candidate\'s raw experience, it does not exist.',
    '- You are NOT required to find a match for every candidate. You may return 0 to N relationships. Most pools will yield 0–4 worth-exploring relationships. If nothing in the pool seems worth proposing, return an empty array and explain the lack in the summary.',
    '- Do not pre-translate or paraphrase the employer situation. Read it as-is.',
    '- This is discovery, not exhaustive classification. Do NOT produce an "unlikely" judgment for non-surfaced candidates.',
    '',
    'On the LAST line of your reply, output a single JSON object and nothing else on that line.',
    'The JSON object MUST have exactly these top-level keys:',
    '  "summary"        : a short free-text paragraph about what you saw in the pool overall',
    '  "relationships"  : an array of objects, each with these keys:',
    '      "candidateId"  : the ID of the candidate (e.g. the candidate\'s "C##" identifier from the pool below)',
    '      "judgment"     : one of "worth_exploring" | "uncertain"',
    '      "analysis"     : a short free-text paragraph explaining this specific judgment',
    '      "evidence"     : an array of short strings, each traceable to the candidate\'s raw experience AND/OR the employer\'s raw situation AND/OR the additional raw intent evidence',
    '      "unknowns"     : an array of short strings describing what you could not determine that materially affects the relationship',
    '      "nextStep"     : a single short string describing ONE concrete next action; not generic "schedule an interview"',
    '',
    'You may write a brief summary above the JSON. The last line MUST be the JSON object and nothing else on that line.',
    '',
    '--- Employer Raw Situation ---',
    '',
    EMPLOYER_RAW_SITUATION,
    '',
    '--- Additional Raw Intent Evidence ---',
    '',
    answerText,
    '',
    `--- Candidate Raw Experiences (${CANDIDATE_POOL.length}) ---`,
    '',
    candidateSection,
  ].join('\n');
}
