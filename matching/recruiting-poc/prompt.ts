import { EMPLOYER_RAW_SITUATION, CANDIDATE_POOL } from './cases.js';

// matching/recruiting-poc/prompt.ts — full-pool relationship
// discovery prompt.
//
// This is a Single-Prompt Full-Pool Oracle baseline. The model
// sees the employer's raw situation (Chinese, verbatim) and all
// 20 candidate raw experiences (English, verbatim) at once. It
// decides which (if any) candidates to surface. The number of
// surfaced relationships is 0..N. No ranking is required. No
// exhaustive "unlikely" classification is produced for
// non-surfaced candidates. This is discovery, not exhaustive
// matching.
//
// Anti-patterns explicitly forbidden by this prompt:
//   - keyword / tech-stack / title / years-based matching
//   - mechanical N×M pairing
//   - ranking / similarity score
//   - "unlikely" for non-surfaced candidates (this is discovery)
//   - invented evidence
//   - solution transfer (an intervention that worked elsewhere
//     is not assumed to apply to the employer's situation)
//
// The output JSON is emitted on the LAST line, mirroring the
// `matching/discovery` pattern. The schema is in `./parse.ts`.

export function buildFullPoolDiscoveryPrompt(): string {
  const candidateSection = CANDIDATE_POOL
    .map((c) => `[${c.id}]\n${c.rawExperience}`)
    .join('\n\n');

  return [
    'You are a full-pool relationship discovery engine for a recruiting experiment.',
    '',
    'You will receive:',
    '- 1 Employer Raw Situation (the company\'s real situation, in Chinese, verbatim)',
    `- ${CANDIDATE_POOL.length} Candidate Raw Experiences (each candidate\'s past experience, in English, natural language)`,
    '',
    'Core question:',
    '',
    '  Based on the raw evidence, which candidates, if any, have actually demonstrated capabilities that could meaningfully help change the employer\'s current situation?',
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
    '      "candidateId"  : the ID of the candidate (e.g. "C03")',
    '      "judgment"     : one of "worth_exploring" | "uncertain"',
    '      "analysis"     : a short free-text paragraph explaining this specific judgment',
    '      "evidence"     : an array of short strings, each traceable to the candidate\'s raw experience AND/OR the employer\'s raw situation',
    '      "unknowns"     : an array of short strings describing what you could not determine that materially affects the relationship',
    '      "nextStep"     : a single short string describing ONE concrete next action; not generic "schedule an interview"',
    '',
    'You may write a brief summary above the JSON. The last line MUST be the JSON object and nothing else on that line.',
    '',
    '--- Employer Raw Situation ---',
    '',
    EMPLOYER_RAW_SITUATION,
    '',
    `--- Candidate Raw Experiences (${CANDIDATE_POOL.length}) ---`,
    '',
    candidateSection,
  ].join('\n');
}
