import { mkdirSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { EMPLOYER_RAW_SITUATION, CANDIDATE_POOL, type Candidate } from './cases.js';
import type { FullPoolDiscoveredRelationship } from './parse.js';

// matching/recruiting-poc/artifact.ts — render and write the
// per-run human-readable Markdown research artifact.
//
// Sections (per Stage 1 §7):
//   1. Employer Raw Situation             (verbatim Chinese)
//   2. Candidate Pool (20 IDs + raw)      (verbatim English)
//   3. Discovered Relationships (per-candidate)
//   4. Not Surfaced                       (IDs only, no explanation)
//   5. Run Metadata (status, duration, count)

const NONE = '—';

export interface ArtifactInputs {
  readonly status: 'succeeded' | 'failed';
  readonly summary: string | null;
  readonly relationships: ReadonlyArray<FullPoolDiscoveredRelationship>;
  readonly errorMessage: string | null;
  readonly durationMs: number;
  readonly stdout: string;
  /**
   * Optional recovery note. When set, a `## Recovery Note` section
   * is rendered between the Run Metadata and the Employer
   * sections, and a `source` bullet is added to the metadata
   * list. Used by the Stage 2 recovery path to re-parse a saved
   * raw output without re-invoking the LLM.
   */
  readonly recoveryNote: string | null;
  readonly recoverySourcePath: string | null;
}

function bullet(s: string): string {
  return `- ${s}`;
}

function computeNotSurfaced(
  pool: ReadonlyArray<Candidate>,
  surfaced: ReadonlyArray<FullPoolDiscoveredRelationship>,
): ReadonlyArray<string> {
  const surfacedIds = new Set(surfaced.map((r) => r.candidateId));
  return pool
    .map((c) => c.id)
    .filter((id) => !surfacedIds.has(id));
}

export function renderFullPoolDiscoveryArtifact(inputs: ArtifactInputs): string {
  const {
    status,
    summary,
    relationships,
    errorMessage,
    durationMs,
    stdout,
    recoveryNote,
    recoverySourcePath,
  } = inputs;
  const notSurfaced = computeNotSurfaced(CANDIDATE_POOL, relationships);

  const meta: string[] = [
    bullet('runtime: hermes via HermesSubprocessClient (oneshot-runner.py)'),
    bullet('poolSize: 20'),
    bullet('method: single-prompt full-pool relationship discovery (no embedding, no vector recall)'),
    bullet(`status: ${status}`),
    bullet(`durationMs: ${durationMs}`),
    bullet(`relationshipCount: ${relationships.length}`),
    bullet(`notSurfacedCount: ${notSurfaced.length}`),
    bullet(`errorMessage: ${errorMessage ?? NONE}`),
  ];
  if (recoverySourcePath !== null) {
    meta.push(bullet(`source: ${recoverySourcePath}`));
  }

  const employerLines: string[] = [
    '## Employer Raw Situation',
    '> Verbatim. No pre-conversion to job schema, skills list, tags, or filter conditions.',
    '',
    '```',
    EMPLOYER_RAW_SITUATION,
    '```',
    '',
  ];

  const candidateLines: string[] = [
    `## Candidate Pool (${CANDIDATE_POOL.length})`,
    '> 20 fixed raw experiences. `id` is identity only; it does not encode category, expected match, or ranking.',
    '',
  ];
  for (const c of CANDIDATE_POOL) {
    candidateLines.push(`### ${c.id}`);
    candidateLines.push('```');
    candidateLines.push(c.rawExperience);
    candidateLines.push('```');
    candidateLines.push('');
  }

  const summaryLines: string[] = ['## Agent Summary'];
  if (summary === null) {
    summaryLines.push('_No summary returned by the Agent._');
  } else {
    summaryLines.push(summary);
  }
  summaryLines.push('');

  const relLines: string[] = [
    `## Discovered Relationships (${relationships.length})`,
    '',
  ];
  if (relationships.length === 0) {
    relLines.push('_No relationships were surfaced by the Agent._');
    relLines.push('');
  } else {
    for (const r of relationships) {
      relLines.push(`### ${r.candidateId} — ${r.judgment}`);
      relLines.push('');
      relLines.push('**analysis**');
      relLines.push(r.analysis);
      relLines.push('');
      relLines.push('**evidence**');
      if (r.evidence.length === 0) relLines.push('_empty_');
      else for (const e of r.evidence) relLines.push(bullet(e));
      relLines.push('');
      relLines.push('**unknowns**');
      if (r.unknowns.length === 0) relLines.push('_empty_');
      else for (const u of r.unknowns) relLines.push(bullet(u));
      relLines.push('');
      relLines.push('**nextStep**');
      relLines.push(r.nextStep);
      relLines.push('');
    }
  }

  const notSurfacedLines: string[] = [
    '## Not Surfaced',
    '',
    '> IDs only. Per Stage 1 §6 this is discovery, not exhaustive classification; no per-candidate explanation.',
    '',
    notSurfaced.length === 0
      ? '_All 20 candidates were surfaced._'
      : notSurfaced.map((id) => bullet(id)).join('\n'),
    '',
  ];

  const sections: string[] = [
    '# Semantic Native Recruiting POC v0 — Full-Pool Relationship Discovery Baseline',
    '## Run Metadata',
    meta.join('\n'),
  ];
  if (recoveryNote !== null) {
    sections.push('## Recovery Note');
    sections.push(recoveryNote);
    sections.push('');
  }
  sections.push(
    ...employerLines,
    ...candidateLines,
    ...summaryLines,
    ...relLines,
    ...notSurfacedLines,
  );

  if (status === 'failed') {
    sections.push('## Raw output (debug)');
    sections.push('```');
    sections.push(stdout);
    sections.push('```');
  }

  return sections.join('\n') + '\n';
}

export function writeFullPoolDiscoveryArtifact(
  inputs: ArtifactInputs,
  options: { fileSuffix?: string } = {},
): string {
  const dir = resolve(process.cwd(), 'artifacts', 'recruiting-poc');
  mkdirSync(dir, { recursive: true });
  const safeTimestamp = new Date().toISOString().replace(/[:.]/g, '-');
  const suffix = options.fileSuffix ?? '';
  const fileName = suffix.length > 0
    ? `${safeTimestamp}_recruiting-poc-discovery${suffix}.md`
    : `${safeTimestamp}_recruiting-poc-discovery.md`;
  const filePath = resolve(dir, fileName);
  writeFileSync(filePath, renderFullPoolDiscoveryArtifact(inputs), 'utf-8');
  return filePath;
}
