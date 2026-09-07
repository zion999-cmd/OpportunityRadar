import type { FullPoolDiscoveredRelationship } from '../parse.js';

// matching/recruiting-poc/intent-update/diff.ts —
// deterministic set-based comparison of three relationship
// sets: Stage 1 baseline, Run A, Run B.
//
// Stage 3 §6: "Comparison 必须由 deterministic code 完成，
// 不调用 LLM...不计算 numeric score...不解释为什么变化."
// This module does only set operations on (id, judgment)
// pairs. It does not call the model. It does not compute
// scores. It does not interpret.
//
// `judgmentChangedInX` is the set of candidate IDs that
// appear in BOTH the baseline and X with a DIFFERENT
// judgment (worth_exploring ↔ uncertain). Candidates that
// are added or removed from the surfaced set are reported
// separately as addedInX / removedInX and are NOT included
// in judgmentChangedInX — they are not "judgment changes",
// they are membership changes.

export interface RelationshipSpaceDiff {
  readonly surfacedInBaseline: ReadonlyArray<string>;
  readonly surfacedInA: ReadonlyArray<string>;
  readonly surfacedInB: ReadonlyArray<string>;
  readonly addedInA: ReadonlyArray<string>;
  readonly removedInA: ReadonlyArray<string>;
  readonly addedInB: ReadonlyArray<string>;
  readonly removedInB: ReadonlyArray<string>;
  readonly judgmentChangedInA: ReadonlyArray<string>;
  readonly judgmentChangedInB: ReadonlyArray<string>;
}

function sortedIds(
  rels: ReadonlyArray<FullPoolDiscoveredRelationship>,
): ReadonlyArray<string> {
  return [...rels.map((r) => r.candidateId)].sort();
}

function setDifference(
  a: ReadonlyArray<string>,
  b: ReadonlyArray<string>,
): ReadonlyArray<string> {
  const bSet = new Set(b);
  return a.filter((x) => !bSet.has(x)).sort();
}

function setIntersection(
  a: ReadonlyArray<string>,
  b: ReadonlyArray<string>,
): ReadonlyArray<string> {
  const bSet = new Set(b);
  return a.filter((x) => bSet.has(x)).sort();
}

export function computeRelationshipSpaceDiff(
  baseline: ReadonlyArray<FullPoolDiscoveredRelationship>,
  runA: ReadonlyArray<FullPoolDiscoveredRelationship>,
  runB: ReadonlyArray<FullPoolDiscoveredRelationship>,
): RelationshipSpaceDiff {
  const baselineIds = sortedIds(baseline);
  const aIds = sortedIds(runA);
  const bIds = sortedIds(runB);

  const baselineJudgments = new Map(
    baseline.map((r) => [r.candidateId, r.judgment] as const),
  );
  const aJudgments = new Map(
    runA.map((r) => [r.candidateId, r.judgment] as const),
  );
  const bJudgments = new Map(
    runB.map((r) => [r.candidateId, r.judgment] as const),
  );

  const judgmentChangedInA: string[] = [];
  for (const id of setIntersection(baselineIds, aIds)) {
    if (baselineJudgments.get(id) !== aJudgments.get(id)) {
      judgmentChangedInA.push(id);
    }
  }

  const judgmentChangedInB: string[] = [];
  for (const id of setIntersection(baselineIds, bIds)) {
    if (baselineJudgments.get(id) !== bJudgments.get(id)) {
      judgmentChangedInB.push(id);
    }
  }

  return {
    surfacedInBaseline: baselineIds,
    surfacedInA: aIds,
    surfacedInB: bIds,
    addedInA: setDifference(aIds, baselineIds),
    removedInA: setDifference(baselineIds, aIds),
    addedInB: setDifference(bIds, baselineIds),
    removedInB: setDifference(baselineIds, bIds),
    judgmentChangedInA: judgmentChangedInA.sort(),
    judgmentChangedInB: judgmentChangedInB.sort(),
  };
}
