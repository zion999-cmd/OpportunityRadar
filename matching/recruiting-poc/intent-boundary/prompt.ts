import { EMPLOYER_RAW_SITUATION, CANDIDATE_POOL } from '../cases.js';
import type { FullPoolDiscoveredRelationship } from '../parse.js';

// matching/recruiting-poc/intent-boundary/prompt.ts —
// Stage 2 prompt: ask the LLM to surface the SINGLE most
// important unresolved question about the employer's actual
// intent that, if answered, would materially change which
// candidate relationships are worth exploring.
//
// Inputs to the prompt:
//   - The Stage 1 Employer Raw Situation (verbatim Chinese)
//   - All 20 Candidate Raw Experiences (verbatim English)
//   - The Stage 1 discovered relationships (the LLM's first
//     read of the situation against the pool)
//
// Anti-leakage (per Stage 2 §B5): the prompt does NOT
//   - name or hint at the specific research observations
//     (e.g. "is Kafka a hard constraint?", "is Kafka a
//     proxy?", "would the employer accept RabbitMQ/Pulsar
//     candidates?", "how would C07/C08/C10/C11/C12/C15
//     change?"). These are research findings, not answers
//     to leak into the prompt.
//   - propose the question for the model.
//   - tell the model which candidate's judgment might flip.
// The model is responsible for finding the most material
// intent-boundary question from the raw evidence alone.
//
// "First real result" policy (Stage 2 §B5): if the model
// surfaces a question that is not Kafka-related (e.g. about
// budget, geography, team shape, scope, or something we
// had not pre-thought), we preserve the result as-is. The
// prompt is not adjusted to nudge toward any specific
// finding.

export interface IntentBoundaryPromptInput {
  readonly discoveredRelationships: ReadonlyArray<FullPoolDiscoveredRelationship>;
}

export function buildIntentBoundaryPrompt(
  input: IntentBoundaryPromptInput,
): string {
  const candidateSection = CANDIDATE_POOL
    .map((c) => `[${c.id}]\n${c.rawExperience}`)
    .join('\n\n');

  const relationshipSection = input.discoveredRelationships
    .map(
      (r) =>
        `[${r.candidateId}] ${r.judgment}\n` +
        `  analysis: ${r.analysis}\n` +
        `  evidence:\n` +
        r.evidence.map((e) => `    - ${e}`).join('\n') +
        `\n` +
        `  unknowns:\n` +
        r.unknowns.map((u) => `    - ${u}`).join('\n'),
    )
    .join('\n\n');

  return [
    'You are an intent-boundary analyst. Your job is to find the SINGLE most important unresolved question about the employer\'s actual intent that, if answered, would materially change which candidate relationships are worth exploring.',
    '',
    'You will receive:',
    '- 1 Employer Raw Situation (the company\'s real situation, in Chinese, verbatim)',
    `- ${CANDIDATE_POOL.length} Candidate Raw Experiences (each candidate\'s past experience, in English, natural language)`,
    '- The Stage 1 discovered relationships: the LLM\'s first read of the situation against the pool, with the candidates it surfaced as worth_exploring or uncertain, and the analysis/evidence/unknowns for each.',
    '',
    'The Stage 1 result is a starting point, not a verdict. Some of the surfaced relationships may rest on an UNSTATED ASSUMPTION about what the employer actually needs. Some of the "uncertain" candidates may be clearly worth_exploring (or clearly not) once a specific intent is clarified. Some "worth_exploring" candidates may not actually fit once the intent is sharpened.',
    '',
    'Your task is to find the ONE unresolved question about the employer\'s actual intent that, if answered, would most materially shift the set of relationships.',
    '',
    'What a good candidate question looks like:',
    '- It gets at a real ambiguity, contradiction, proxy, or unstated boundary in the employer\'s situation.',
    '- It distinguishes a real-world constraint from a proxy signal (something that looks like the constraint but is actually measuring something else).',
    '- It uses the DIFFERENCES among the candidate evidence to motivate why the question matters. If different candidates in the pool diverge in a way that maps onto a specific intent dimension, the question is on that dimension.',
    '- The answer would change the judgment (worth_exploring ↔ uncertain ↔ not surfaced) for at least one candidate, ideally more than one.',
    '- It is a question the employer can actually answer, not a question for you to research.',
    '- It is specific enough to be binary or near-binary (yes/no, A/B, this scope vs that scope), not a vague open-ended prompt.',
    '',
    'What does NOT count:',
    '- A form field: "what is the budget?", "what is the salary range?", "what is the title?", "what is the start date?" — these are HR intake questions, not intent-boundary questions.',
    '- A question that is already answered by the Employer Raw Situation as written.',
    '- A question whose answer would not change any judgment.',
    '- A question that asks the model to re-judge the candidates, not the employer.',
    '- More than one question. ONE question only.',
    '',
    'How to use the candidate evidence:',
    '- Look at the candidates that the Stage 1 result treated DIFFERENTLY despite similar capability profiles. The dimension on which they differ is a candidate for the question.',
    '- Look at the candidates that the Stage 1 result treated SIMILARLY despite very different evidence bases. The unstated assumption that grouped them is a candidate for the question.',
    '- Look at the Stage 1 `unknowns` lists. A pattern across many unknowns on the same dimension is a candidate for the question.',
    '',
    'Output format:',
    'On the LAST line of your reply, output a single JSON object and nothing else on that line. The JSON object MUST have exactly these top-level keys:',
    '  "question"               : the single most important unresolved intent question (one sentence, phrased as a question)',
    '  "whyItMatters"           : one or two sentences on what would change if this were answered',
    '  "affectedRelationships"  : an array of objects, each with these keys:',
    '      "candidateId"        : the ID of a candidate whose judgment would shift if the question is answered (e.g. "C03")',
    '      "ifAnswerA"          : what would change about this candidate if the answer goes one way',
    '      "ifAnswerB"          : what would change about this candidate if the answer goes the other way',
    '  "evidence"              : an array of short strings, each a direct quote or close paraphrase from the Employer Raw Situation or a candidate raw experience that motivates the question',
    '',
    'You may write a short explanation above the JSON. The last line MUST be the JSON object and nothing else on that line.',
    '',
    '--- Employer Raw Situation ---',
    '',
    EMPLOYER_RAW_SITUATION,
    '',
    `--- Candidate Raw Experiences (${CANDIDATE_POOL.length}) ---`,
    '',
    candidateSection,
    '',
    `--- Stage 1 Discovered Relationships (${input.discoveredRelationships.length}) ---`,
    '',
    relationshipSection,
  ].join('\n');
}
