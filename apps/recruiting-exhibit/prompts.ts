// apps/recruiting-exhibit/prompts.ts — the two model prompts
// the exhibit uses per observation run.
//
// Per task.md §"语义处理":
//   "需要的模型步骤只有两个：
//      A. Evidence Reconstruction
//         输入：public source material
//         输出保留：
//           directly supported
//           implied meaning
//           hypotheses / unknowns
//      B. Relationship Reasoning
//         输入：current raw Situation + reconstructed Evidence
//         输出：
//           surface | do_not_surface
//           why relevant
//           evidence used
//           most important unknown"
//   "不做 skill extraction / tag extraction / ranking model。"
//
// Both prompts are blind — they take only the natural-language
// inputs and produce a Zod-validated JSON shape on the last
// line. The prompt does not mention scores, percentages, or
// keyword matching.

import type { FetchedItem } from './fetch.js';

export function buildEvidenceReconstructionPrompt(item: FetchedItem, sourceLabel: string): string {
  return `You are reconstructing one piece of public evidence for an exhibit.

SOURCE LABEL
${sourceLabel}

TITLE
${item.title}

URL
${item.url}

RAW EXCERPT
---
${item.excerpt}
---

Preserve the source's actual meaning. Do not invent. Do not normalize. Output exactly three natural-language fields:

1. directly_supported — what the excerpt directly says, in one or two sentences.
2. implied_meaning — what the excerpt implies but does not say outright, in one or two sentences.
3. hypotheses_unknowns — what would still need to be true (or be checked) for the implied meaning to hold, in one or two sentences.

Do not extract skills, tags, keywords, scores, or categories. Do not name a person unless the excerpt names one.

On the last line output one strict JSON object with exactly: {"directly_supported":"...","implied_meaning":"...","hypotheses_unknowns":"..."}`;
}

export function buildRelationshipReasoningPrompt(situation: string, reconstruction: {
  readonly directlySupported: string;
  readonly impliedMeaning: string;
  readonly hypothesesUnknowns: string;
}): string {
  return `You are deciding whether one piece of reconstructed evidence has a defensible relationship with the user's current Situation.

CURRENT SITUATION (raw, unparsed)
---
${situation}
---

RECONSTRUCTED EVIDENCE
directly supported: ${reconstruction.directlySupported}
implied meaning: ${reconstruction.impliedMeaning}
hypotheses / unknowns: ${reconstruction.hypothesesUnknowns}

Choose exactly one of: surface, do_not_surface.

If surface, give:
  why_relevant — one or two sentences naming the specific situation-side reason this evidence may matter.
  evidence_used — one or two sentences naming the specific evidence-side reason.
  most_important_unknown — one sentence naming the single most important thing still unknown.

If do_not_surface, give the same fields but each should be one short sentence explaining why there is no defensible relationship.

Do not produce scores, percentages, or skill / tag / keyword matches. Do not rank. The decision is binary.

On the last line output one strict JSON object with exactly: {"surface_decision":"surface|do_not_surface","why_relevant":"...","evidence_used":"...","most_important_unknown":"..."}`;
}
