import { mkdirSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { EMPLOYER_RAW_SITUATION, CANDIDATE_POOL } from '../cases.js';
import type { FullPoolDiscoveredRelationship } from '../parse.js';
import type {
  IntentBoundaryOutput,
  AffectedRelationship,
} from './parse.js';

// matching/recruiting-poc/intent-boundary/artifact.ts —
// render and write the per-run human-readable Markdown
// research artifact for the Intent Boundary stage.
//
// Sections (per Stage 2 §C):
//   1. Employer Raw Situation
//   2. Stage 1 Discovered Relationships
//   3. Intent Boundary Question
//   4. Why It Matters
//   5. Affected Relationships
//   6. Evidence
//   7. Raw Hermes Output (debug; only on failure)
//   8. Runtime Metadata

const NONE = '—';

export interface IntentBoundaryArtifactInputs {
  readonly status: 'succeeded' | 'failed';
  readonly discoveredRelationships: ReadonlyArray<FullPoolDiscoveredRelationship>;
  readonly intentBoundary: IntentBoundaryOutput | null;
  readonly errorMessage: string | null;
  readonly durationMs: number;
  readonly stdout: string;
}

function bullet(s: string): string {
  return `- ${s}`;
}

function renderRelationship(rel: FullPoolDiscoveredRelationship): string {
  const lines: string[] = [`### ${rel.candidateId} — ${rel.judgment}`, ''];
  lines.push('**analysis**');
  lines.push(rel.analysis);
  lines.push('');
  lines.push('**evidence**');
  if (rel.evidence.length === 0) {
    lines.push('_empty_');
  } else {
    for (const e of rel.evidence) lines.push(bullet(e));
  }
  lines.push('');
  lines.push('**unknowns**');
  if (rel.unknowns.length === 0) {
    lines.push('_empty_');
  } else {
    for (const u of rel.unknowns) lines.push(bullet(u));
  }
  lines.push('');
  return lines.join('\n');
}

function renderAffected(ar: AffectedRelationship): string {
  return [
    `### ${ar.candidateId}`,
    '',
    `- if answer A: ${ar.ifAnswerA}`,
    `- if answer B: ${ar.ifAnswerB}`,
    '',
  ].join('\n');
}

export function renderIntentBoundaryArtifact(
  inputs: IntentBoundaryArtifactInputs,
): string {
  const {
    status,
    discoveredRelationships,
    intentBoundary,
    errorMessage,
    durationMs,
    stdout,
  } = inputs;

  const meta: string[] = [
    bullet('runtime: hermes via HermesSubprocessClient (oneshot-runner.py)'),
    bullet('stage: 2 of 2 (Intent Boundary Discovery)'),
    bullet('method: single-prompt intent-boundary question, ONE question only'),
    bullet(`status: ${status}`),
    bullet(`durationMs: ${durationMs}`),
    bullet(`discoveredRelationshipCount: ${discoveredRelationships.length}`),
    bullet(`affectedRelationshipCount: ${intentBoundary?.affectedRelationships.length ?? 0}`),
    bullet(`evidenceCount: ${intentBoundary?.evidence.length ?? 0}`),
    bullet(`errorMessage: ${errorMessage ?? NONE}`),
  ];

  const employerLines: string[] = [
    '## 1. Employer Raw Situation',
    '> Verbatim. No pre-conversion to job schema, skills list, tags, or filter conditions.',
    '',
    '```',
    EMPLOYER_RAW_SITUATION,
    '```',
    '',
  ];

  const stage1Lines: string[] = [
    `## 2. Stage 1 Discovered Relationships (${discoveredRelationships.length})`,
    '',
    '> Recovered from the Stage 1 oracle run; no new relationship judgments are produced at this stage.',
    '',
  ];
  if (discoveredRelationships.length === 0) {
    stage1Lines.push('_No relationships were surfaced at Stage 1._');
    stage1Lines.push('');
  } else {
    for (const r of discoveredRelationships) {
      stage1Lines.push(renderRelationship(r));
    }
  }

  const questionLines: string[] = ['## 3. Intent Boundary Question', ''];
  if (intentBoundary === null) {
    questionLines.push('_No intent boundary question was produced._');
    questionLines.push('');
  } else {
    questionLines.push(intentBoundary.question);
    questionLines.push('');
  }

  const whyLines: string[] = ['## 4. Why It Matters', ''];
  if (intentBoundary === null) {
    whyLines.push('_—_');
    whyLines.push('');
  } else {
    whyLines.push(intentBoundary.whyItMatters);
    whyLines.push('');
  }

  const affectedLines: string[] = [
    '## 5. Affected Relationships',
    '',
    '> For each candidate the LLM says would shift, both directions are listed. If the LLM\'s question is about a generic dimension with no specific candidate impact, this section is the LLM\'s claim, not a verified prediction.',
    '',
  ];
  if (intentBoundary === null || intentBoundary.affectedRelationships.length === 0) {
    affectedLines.push('_No affected relationships reported._');
    affectedLines.push('');
  } else {
    for (const ar of intentBoundary.affectedRelationships) {
      affectedLines.push(renderAffected(ar));
    }
  }

  const evidenceLines: string[] = ['## 6. Evidence', ''];
  if (intentBoundary === null || intentBoundary.evidence.length === 0) {
    evidenceLines.push('_No supporting evidence quoted._');
    evidenceLines.push('');
  } else {
    for (const e of intentBoundary.evidence) evidenceLines.push(bullet(e));
    evidenceLines.push('');
  }

  const sections: string[] = [
    '# Semantic Native Recruiting POC v0 — Stage 2: Intent Boundary Discovery',
    '## 8. Runtime Metadata',
    meta.join('\n'),
    '',
    ...employerLines,
    ...stage1Lines,
    ...questionLines,
    ...whyLines,
    ...affectedLines,
    ...evidenceLines,
  ];

  if (status === 'failed') {
    sections.push('## 7. Raw Hermes Output (debug)');
    sections.push('```');
    sections.push(stdout);
    sections.push('```');
  }

  return sections.join('\n') + '\n';
}

export function writeIntentBoundaryArtifact(
  inputs: IntentBoundaryArtifactInputs,
): string {
  const dir = resolve(process.cwd(), 'artifacts', 'recruiting-poc');
  mkdirSync(dir, { recursive: true });
  const safeTimestamp = new Date().toISOString().replace(/[:.]/g, '-');
  const fileName = `${safeTimestamp}_recruiting-poc-intent-boundary.md`;
  const filePath = resolve(dir, fileName);
  writeFileSync(filePath, renderIntentBoundaryArtifact(inputs), 'utf-8');
  return filePath;
}

// Visible-to-artifact fact: this stage is intentionally
// narrow. We do NOT produce a 21-candidate re-ranking, a new
// judgment, or a confirmation that the Stage 1 result was
// correct. The CANDIDATE_POOL import above is retained only
// to keep this module's imports consistent with the Stage 1
// artifact, and to make it cheap to add a candidate-cross-
// reference later if a future Proposal decides the LLM's
// `affectedRelationships.candidateId` claims should be
// validated against the pool.
void CANDIDATE_POOL;
