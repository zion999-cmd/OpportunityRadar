// semantic-completion/prompt.ts — build the two prompts for this
// experiment.
//
//   buildCompletionPrompt(label, material)
//     One call per raw material. The model produces a structured
//     completion with three regions:
//       - directly_supported
//       - implied_meaning
//       - hypotheses_and_unknowns
//
//   buildRelationshipPrompt(aRaw, aCompletion, bRaw, bCompletion)
//     One call once both completions are parsed. The model reasons
//     about whether capability in A could meaningfully change
//     situation B, without relying on shared technology keywords,
//     and distinguishes supported reasoning (Raw Evidence +
//     implied meaning only) from what still needs evidence
//     (hypotheses are allowed here, but NOT as relationship
//     evidence).
//
// The output contract mirrors the matching/discovery POC: prose is
// allowed above a single JSON object on the LAST line. Zod
// validation in parse.ts only inspects the JSON.

import type { CompletionOutput, RelationshipOutput } from './parse.js';

export type CompletionLabel = 'A' | 'B';

export function buildCompletionPrompt(
  label: CompletionLabel,
  material: string,
): string {
  return [
    'You are performing a Semantic Completion pass on a single piece of raw material.',
    '',
    'Rules:',
    '- Preserve the original wording. Do not rewrite, summarize, compress, paraphrase, or extend the material.',
    '- Do not extract keywords, tags, skills, or categories.',
    '- Do not expand any named technology (e.g. "Kafka", "RabbitMQ", "Pulsar") into a list of technical keywords. The point is meaning and causal / capability relationships, not a tech inventory.',
    '',
    'Output three regions, each with a strict meaning:',
    '',
    '  directly_supported',
    '    ONLY facts that the Raw Material explicitly states.',
    '    Do not add any fact that is not literally in the text.',
    '    If a fact is not directly stated, it does not belong here, even if it is obvious or true.',
    '',
    '  implied_meaning',
    '    Allow only the meaning that can be inferred by common-sense understanding of the facts in the Raw Material: implied meaning, capability, causation, or situation.',
    '    For each conclusion, name which facts in the Raw Material jointly support it.',
    '    It is FORBIDDEN to write "possible specific technical mechanisms" as implied meaning. A candidate mechanism that explains why the symptoms occur, but the Raw Material does not name it, is a hypothesis, not implied meaning.',
    '',
    '  hypotheses_and_unknowns',
    '    Anything the Raw Material does not determine, but that is worth further investigation, must stay here: candidate explanations, candidate mechanisms, and possibilities, framed as hypothesis or unknown.',
    '    Do NOT upgrade a hypothesis into a demonstrated capability or a fact.',
    '',
    'Concrete examples of the boundary (for the current material):',
    '  In Situation A, partition imbalance / consumer assignment / under-replicated partitions / re-keying are NOT stated in the Raw Material. They are FORBIDDEN in directly_supported or implied_meaning; they may appear in hypotheses_and_unknowns as candidate mechanisms worth investigating.',
    '  In Situation B, "RabbitMQ capacity / routing / back-pressure" as the cause of the backlog is NOT stated in the Raw Material. It is FORBIDDEN in directly_supported or implied_meaning; it may appear in hypotheses_and_unknowns as a candidate cause worth investigating.',
    '',
    'On the LAST line of your reply, output a single JSON object and nothing else on that line.',
    'The JSON object MUST have exactly these top-level keys:',
    '  "directlySupported"      : string',
    '  "impliedMeaning"          : string',
    '  "hypothesesAndUnknowns"   : string',
    '',
    'You may write a brief introduction above the JSON. The last line MUST be the JSON object and nothing else on that line.',
    '',
    `--- Raw material ${label} ---`,
    '',
    material,
  ].join('\n');
}

function renderCompletionBlock(label: CompletionLabel, c: CompletionOutput): string {
  return [
    `### directly_supported — Situation ${label}`,
    c.directlySupported,
    '',
    `### implied_meaning — Situation ${label}`,
    c.impliedMeaning,
    '',
    `### hypotheses_and_unknowns — Situation ${label}`,
    c.hypothesesAndUnknowns,
  ].join('\n');
}

export function buildRelationshipPrompt(
  aRaw: string,
  aCompletion: CompletionOutput,
  bRaw: string,
  bCompletion: CompletionOutput,
): string {
  return [
    'You are performing a Relationship Reasoning pass between two situations, using their raw materials and their Semantic Completions.',
    '',
    'Core question:',
    '  Could the capability demonstrated in Situation A meaningfully change Situation B toward a better outcome?',
    '',
    'Epistemic rules:',
    '- The relationship must be supported mainly by Raw Evidence (the raw materials) and implied meaning (the inferences grounded in facts in the raw materials).',
    '- Hypotheses are allowed only to generate "what needs to be confirmed"; they are NOT allowed as Evidence that the relationship holds.',
    '',
    'Other rules:',
    '- Do NOT rely on shared technology keywords. Do NOT list shared tech. Reason about the underlying capability, causation, and ownership structure.',
    '- Distinguish supported reasoning (claims you can back from Raw Evidence + implied meaning) from what still needs evidence (claims that would require additional information to confirm, including hypotheses).',
    '',
    'On the LAST line of your reply, output a single JSON object and nothing else on that line.',
    'The JSON object MUST have exactly these top-level keys:',
    '  "supportedReasoning" : string  (claims you can support from Raw Evidence + implied meaning, without relying on shared technology keywords)',
    '  "stillNeedsEvidence" : string  (claims that would need additional evidence to confirm, including hypotheses)',
    '',
    'You may write a brief introduction above the JSON. The last line MUST be the JSON object and nothing else on that line.',
    '',
    '--- Situation A — raw material ---',
    '',
    aRaw,
    '',
    '--- Situation A — semantic completion ---',
    '',
    renderCompletionBlock('A', aCompletion),
    '',
    '--- Situation B — raw material ---',
    '',
    bRaw,
    '',
    '--- Situation B — semantic completion ---',
    '',
    renderCompletionBlock('B', bCompletion),
  ].join('\n');
}

export type { RelationshipOutput };
