import type { ExplorationGoal } from '../contracts/exploration-goal.js';
import type { EvidenceCandidate, CandidateSource } from '../contracts/evidence-candidate.js';
import type { ExplorationRunOutcome, RunRecord } from '../bridge/exploration-bridge.js';

// exploration/artifact/exploration-artifact.ts — render a Markdown
// artifact for a single completed `explore` run.
//
// This module is a pure, deterministic, in-memory markdown
// formatter. It does NOT touch the database, the filesystem, the
// network, or any Agent Runtime. The caller is responsible for
// gathering all the inputs (the run record, the in-memory Agent
// result, and the P0001 evidence rows written by the bridge for
// THIS run) and passing them in.
//
// Per the task that introduced this module:
//   - It is a development-period artifact, not a new business
//     persistence model. Nothing here is written back to the
//     Domain. The output is a human-readable Markdown file, the
//     closest equivalent of "dev-time printf" for the explore
//     loop.
//   - It does NOT modify the ExplorationResult business semantics.
//     `ExplorationResult` is still the Agent's signed output; this
//     module only reformats it.
//   - It does NOT enrich rejection reasons. If the existing
//     pipeline captured a reason (the P0002 §6 provenance gate:
//     empty `source.url` → reject), the artifact surfaces it. If
//     the pipeline did NOT capture a reason (P0001 ingest threw
//     and the bridge swallowed the message), the artifact says so
//     plainly and does NOT invent a richer explanation.
//
// Per-candidate decision logic:
//   1. If `candidate.source.url` is empty/blank → "rejected (no
//      source URL — P0002 §6 provenance gate)". Deterministic
//      from the in-memory candidate; matches the bridge's gate.
//   2. Else if the candidate's `claim` matches an accepted
//      evidence row from the same run → "accepted" with the
//      resulting P0001 `evidenceId` and source URL.
//   3. Else → "rejected (P0001 ingest failed)". The bridge
//      catches the P0001 throw and increments `rejected`, but
//      does not surface the message; the artifact mirrors that.

/** One P0001 evidence row that the bridge wrote for this run. */
export interface AcceptedEvidenceRow {
  readonly id: string;
  readonly claim: string;
  readonly sourceId: string;
  readonly sourceCanonicalUrl: string;
}

export interface ArtifactInputs {
  readonly goal: ExplorationGoal;
  readonly runRecord: RunRecord;
  readonly outcome: ExplorationRunOutcome;
  readonly acceptedEvidence: ReadonlyArray<AcceptedEvidenceRow>;
}

/** Per-candidate decision, for tests and explicit callers. */
export type CandidateDecision =
  | {
      readonly kind: 'rejected';
      readonly reason: 'no_source_url';
      readonly detail: 'no source URL — P0002 §6 provenance gate';
    }
  | {
      readonly kind: 'rejected';
      readonly reason: 'p0001_ingest_failed';
      readonly detail: 'P0001 ingest failed (no specific reason captured by the existing pipeline)';
    }
  | {
      readonly kind: 'accepted';
      readonly evidenceId: string;
      readonly sourceId: string;
      readonly sourceCanonicalUrl: string;
    };

/**
 * Compute the per-candidate decision from in-memory data + the
 * accepted-evidence rows written by this run. Pure: no I/O.
 *
 * Exported for tests; the markdown renderer below calls it
 * internally.
 */
export function decideCandidate(
  candidate: EvidenceCandidate,
  acceptedByClaim: ReadonlyMap<string, AcceptedEvidenceRow>,
): CandidateDecision {
  const url = candidate.source.url;
  if (typeof url !== 'string' || url.trim().length === 0) {
    return { kind: 'rejected', reason: 'no_source_url', detail: 'no source URL — P0002 §6 provenance gate' };
  }
  const hit = acceptedByClaim.get(candidate.claim);
  if (hit !== undefined) {
    return {
      kind: 'accepted',
      evidenceId: hit.id,
      sourceId: hit.sourceId,
      sourceCanonicalUrl: hit.sourceCanonicalUrl,
    };
  }
  return {
    kind: 'rejected',
    reason: 'p0001_ingest_failed',
    detail: 'P0001 ingest failed (no specific reason captured by the existing pipeline)',
  };
}

/** YAML-ish list item writer; keeps the artifact deterministic. */
function bullet(line: string): string {
  return `- ${line}`;
}

/** Empty/None rendering for nullable fields. */
const NONE = '—';

/** RFC 3339 / ISO 8601 — used verbatim in the artifact. */
function isoOrNone(s: string | null): string {
  return s === null || s === undefined || s === '' ? NONE : s;
}

function joinList(xs: ReadonlyArray<string>, empty = NONE): string {
  if (xs.length === 0) return empty;
  return xs.join(', ');
}

/** Render the per-candidate decisions as Markdown. */
function renderCandidateSections(
  candidates: ReadonlyArray<EvidenceCandidate>,
  acceptedByClaim: ReadonlyMap<string, AcceptedEvidenceRow>,
): string {
  if (candidates.length === 0) {
    return '_No evidence candidates were proposed by the Agent._';
  }
  return candidates
    .map((c, i) => {
      const decision = decideCandidate(c, acceptedByClaim);
      const lines: string[] = [];
      lines.push(`### Candidate ${i + 1} — ${c.subject}`);
      lines.push(bullet(`claim: ${c.claim}`));
      lines.push(bullet(`evidence type: ${c.evidenceType}`));
      lines.push(bullet(`market: ${c.market}`));
      lines.push(bullet(`eventAt: ${isoOrNone(c.eventAt)}`));
      lines.push(bullet(`supporting source URL: ${isoOrNone(c.source.url)}`));
      lines.push(bullet(`supporting source publisher: ${c.source.publisher}`));
      lines.push(bullet(`supporting source title: ${c.source.title}`));
      if (decision.kind === 'accepted') {
        lines.push(bullet(`final decision: **accepted**`));
        lines.push(bullet(`evidenceId: \`${decision.evidenceId}\``));
        lines.push(bullet(`sourceDocumentId: \`${decision.sourceId}\``));
        lines.push(bullet(`source URL: ${decision.sourceCanonicalUrl}`));
      } else {
        lines.push(bullet(`final decision: **rejected**`));
        lines.push(bullet(`reason: ${decision.detail}`));
      }
      return lines.join('\n');
    })
    .join('\n\n');
}

function renderSourceSections(sources: ReadonlyArray<CandidateSource>): string {
  if (sources.length === 0) {
    return '_No sources were listed by the Agent._';
  }
  return sources
    .map((s, i) => {
      const lines: string[] = [];
      lines.push(`### Source ${i + 1} — ${s.title}`);
      lines.push(bullet(`publisher: ${s.publisher}`));
      lines.push(bullet(`canonicalUrl: ${s.url}`));
      lines.push(bullet(`publishedAt: ${isoOrNone(s.publishedAt)}`));
      lines.push(bullet(`accessedAt: ${s.accessedAt}`));
      lines.push(bullet(`sourceType: ${s.sourceType}`));
      lines.push(bullet(`language: ${s.language}`));
      return lines.join('\n');
    })
    .join('\n\n');
}

function renderAcceptedEvidenceSection(
  accepted: ReadonlyArray<AcceptedEvidenceRow>,
): string {
  if (accepted.length === 0) {
    return '_No Evidence rows were written to the P0001 Evidence Store for this run._';
  }
  return accepted
    .map((row) => {
      const lines: string[] = [];
      lines.push(`### Evidence \`${row.id}\``);
      lines.push(bullet(`claim: ${row.claim}`));
      lines.push(bullet(`sourceDocumentId: \`${row.sourceId}\``));
      lines.push(bullet(`source URL: ${row.sourceCanonicalUrl}`));
      return lines.join('\n');
    })
    .join('\n\n');
}

/**
 * Render the Markdown artifact for a single `explore` run.
 *
 * Pure: no I/O, no globals, no Agent-Runtime references. The
 * caller passes the in-memory `outcome` (which contains the
 * Agent's `ExplorationResult`), the `runRecord` (for startedAt /
 * completedAt / status / counts), the `goal` (for question /
 * market / etc.), and the list of P0001 Evidence rows the bridge
 * wrote for THIS run.
 */
export function renderExplorationArtifact(inputs: ArtifactInputs): string {
  const { goal, runRecord, outcome, acceptedEvidence } = inputs;
  const acceptedByClaim = new Map<string, AcceptedEvidenceRow>();
  for (const row of acceptedEvidence) {
    acceptedByClaim.set(row.claim, row);
  }

  const summary = outcome.result?.summary ?? NONE;
  const sources = outcome.result?.sources ?? [];
  const candidates = outcome.result?.evidenceCandidates ?? [];

  const goalLines: string[] = [
    bullet(`runId: \`${runRecord.id}\``),
    bullet(`goalId: \`${goal.id}\``),
    bullet(`market: ${goal.market}`),
    bullet(`question: ${goal.question}`),
    bullet(`timeWindow: ${goal.timeWindow ?? NONE}`),
    bullet(`evidenceInterests: ${joinList(goal.evidenceInterests ?? [])}`),
  ];

  const runMetaLines: string[] = [
    bullet(`runtimeId: ${runRecord.runtimeId}`),
    bullet(`startedAt: ${runRecord.startedAt}`),
    bullet(`completedAt: ${isoOrNone(runRecord.completedAt)}`),
    bullet(`status: ${runRecord.status}`),
    bullet(`candidateCount: ${runRecord.candidateCount}`),
    bullet(`acceptedCount: ${runRecord.acceptedCount}`),
    bullet(`rejectedCount: ${runRecord.rejectedCount}`),
    bullet(`errorMessage: ${isoOrNone(runRecord.errorMessage)}`),
  ];

  const sections: string[] = [
    `# Exploration Run`,
    `## Goal`,
    goalLines.join('\n'),
    `## Run Metadata`,
    runMetaLines.join('\n'),
    `## Agent Summary`,
    summary === NONE ? '_No summary returned by the Agent._' : summary,
    `## Sources`,
    renderSourceSections(sources),
    `## Evidence Candidates`,
    renderCandidateSections(candidates, acceptedByClaim),
    `## Accepted Evidence`,
    renderAcceptedEvidenceSection(acceptedEvidence),
  ];

  return sections.join('\n\n') + '\n';
}
