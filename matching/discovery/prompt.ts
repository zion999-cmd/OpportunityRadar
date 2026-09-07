import type { RecruitingMaterial, ApplyingMaterial } from './pools.js';

// matching/discovery/prompt.ts — render the two pools as a
// Hermes-shaped blind prompt for *relationship discovery*.
//
// The key difference vs the bilateral matching prompt
// (matching/prompt.ts): the discovery prompt does NOT ask the
// model to evaluate a pre-specified pair. It asks the model to
// look at the two pools as a whole, decide which pairs (if any)
// are worth exploring, and surface only those.
//
// Anti-pattern explicitly called out: "do NOT mechanically pair
// every recruiting material with every applying material and
// rank them." The model's job is to read the materials, decide
// what looks worth proposing, and propose only those.

export interface DiscoveryInput {
  readonly recruiting: ReadonlyArray<RecruitingMaterial>;
  readonly applying: ReadonlyArray<ApplyingMaterial>;
}

export function buildDiscoveryPrompt(input: DiscoveryInput): string {
  const recruitingSection = input.recruiting
    .map((r) => `[${r.id}]\n${r.material}`)
    .join('\n\n');
  const applyingSection = input.applying
    .map((a) => `[${a.id}]\n${a.material}`)
    .join('\n\n');

  return [
    'You are a relationship discovery engine for a bilateral matching experiment.',
    '',
    'You will receive two pools of natural-language material:',
    `- ${input.recruiting.length} recruiting materials (organizations describing roles they need to fill)`,
    `- ${input.applying.length} applying materials (people describing their situations, intentions, and capability)`,
    '',
    'Your task: actively propose a SMALL number of relationships that look worth exploring between the two pools. You decide which pairs. You are NOT required to find a relationship for every person or every role.',
    '',
    'Critical: this is NOT exhaustive matching. Do not mechanically pair every recruiting material with every applying material and rank them. Read the materials, decide what looks worth proposing, and propose only those.',
    '',
    'You may return between 0 and N×M relationships. Most pools will yield 0–4 worth-exploring relationships. If nothing in the two pools seems worth proposing, return an empty array and explain the lack in the summary.',
    '',
    'A "worth_exploring" relationship is one where there is a real, non-obvious reason for both sides to spend more time on each other. "Uncertain" is appropriate when there is a possibility but key facts are missing. "Unlikely" is appropriate when, looking past surface keywords, the situations do not fit.',
    '',
    'On the LAST line of your reply, output a single JSON object and nothing else on that line.',
    'The JSON object MUST have exactly these top-level keys:',
    '  "summary"        : a short free-text paragraph about what you saw in the two pools overall',
    '  "relationships"  : an array of objects, each with these keys:',
    '      "recruitingId"  : the ID of the recruiting material (e.g. "R3")',
    '      "applyingId"    : the ID of the applying material (e.g. "A7")',
    '      "judgment"      : one of "worth_exploring" | "uncertain" | "unlikely"',
    '      "analysis"      : a short free-text paragraph explaining this specific judgment',
    '      "evidence"      : an array of short strings (you may prefix entries with [OBSERVED], [INFERRED], or [CONFLICT] if it helps, but you do not have to)',
    '      "unknowns"      : an array of short strings describing what you could not determine',
    '      "nextStep"      : a single short string describing one concrete next action',
    '',
    'You may write a brief summary above the JSON. The last line MUST be the JSON object and nothing else on that line.',
    '',
    '--- Recruiting pool ---',
    '',
    recruitingSection,
    '',
    '--- Applying pool ---',
    '',
    applyingSection,
  ].join('\n');
}
