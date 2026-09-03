import type { ExplorationGoal } from '../../exploration/contracts/exploration-goal.js';

// runtime/hermes/prompt.ts — translate a Radar ExplorationGoal into
// a Hermes-shaped blind prompt.
//
// This file is the ONLY place where Radar's neutral domain shape
// is rendered into the textual prompt language Hermes consumes.
// The adapter does not need to know that "question" + "market" +
// "timeWindow" + "evidenceInterests" exist; it just calls
// `buildHermesPrompt(goal)` and passes the result to the Hermes
// client. The reverse mapping (Hermes text → ExplorationResult) is
// in `./parse.ts`.

/**
 * Render an ExplorationGoal as a Hermes prompt.
 *
 * The prompt is "blind" in two senses:
 *  - Hermes does not see the JSON shape of the Goal; it sees
 *    prose. The adapter is responsible for rendering.
 *  - Hermes is told to return a JSON object on the last line so
 *    the adapter can parse it deterministically (see
 *    `parseHermesOutput`). Hermes's own tool/MCP planning is
 *    unconstrained; only the final summary line is structured.
 *
 * The `evidenceInterests` list is rendered as hints, not as
 * filters. Hermes is free to surface anything it considers
 * relevant; the contract is "the JSON's `evidenceCandidates`
 * are the facts", not "every fact must match an interest".
 */
export function buildHermesPrompt(goal: ExplorationGoal): string {
  const lines: string[] = [
    'You are an exploration agent for an opportunity intelligence product.',
    'Your task: answer the question below by surfacing concrete, real-world facts from the public web.',
    'Each fact must be a single observable event (funding round, product launch, customer case, financial report, policy, etc.), backed by a publicly retrievable source URL.',
    '',
    `Question: ${goal.question}`,
    `Market: ${goal.market}`,
  ];
  if (goal.timeWindow !== undefined) {
    lines.push(`Time window: ${goal.timeWindow}`);
  }
  if (goal.evidenceInterests !== undefined && goal.evidenceInterests.length > 0) {
    lines.push(`Evidence interests: ${goal.evidenceInterests.join(', ')}`);
  }
  lines.push('');
  lines.push('Output requirements (STRICT — non-negotiable):');
  lines.push('- Write ONE short human-readable summary of what you found.');
  lines.push('- After the summary, on the LAST line of your reply, output a single JSON object and NOTHING ELSE on that line.');
  lines.push('- The JSON object MUST have exactly these three top-level keys: "summary" (string, repeat your human-readable summary), "sources" (array), "evidenceCandidates" (array).');
  lines.push('- EVERY fact you found goes INTO "evidenceCandidates" — do NOT print facts as a separate list, code block, or inline JSON before the final JSON object.');
  lines.push('- Do NOT print any tool output, code fence, or markdown list. Your entire reply is: summary text, then a blank line, then the single JSON object on the last line.');
  lines.push('- "sources" and "evidenceCandidates" are arrays; each item has the exact shape shown below.');
  lines.push('  sources: [{"url": "...", "publisher": "...", "title": "...", "publishedAt": "<ISO8601 or null>", "accessedAt": "<ISO8601>", "sourceType": "news|press_release|filing|case_study|blog|social|filing_sec|government|paper|database|other", "language": "<ISO 639-1>"}]');
  lines.push('  evidenceCandidates: [{"claim": "...", "subject": "...", "evidenceType": "funding|valuation|revenue|growth|customer_adoption|product_launch|acquisition|policy|technology_capability|market_activity|usage", "eventAt": "<ISO8601 or null>", "market": "<CN|US|GLOBAL|OTHER>", "source": {<same source shape as above, picked from sources by url>}}]');
  lines.push('- If your web tools returned no data, or you could not verify any fact, output the JSON with empty "sources" and "evidenceCandidates" arrays. Do not invent facts.');
  return lines.join('\n');
}
