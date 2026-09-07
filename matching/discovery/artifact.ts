import { mkdirSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import type { RecruitingMaterial, ApplyingMaterial } from './pools.js';
import type { DiscoveredRelationship } from './parse.js';

// matching/discovery/artifact.ts — render and write the
// per-discovery human-readable Markdown artifact.
//
// Pure: no DB, no Runtime, no globals. The caller passes the
// inputs; this module renders and (separately) writes.

const NONE = '—';

export interface ArtifactInputs {
  readonly recruitingPool: ReadonlyArray<RecruitingMaterial>;
  readonly applyingPool: ReadonlyArray<ApplyingMaterial>;
  readonly status: 'succeeded' | 'failed';
  readonly summary: string | null;
  readonly relationships: ReadonlyArray<DiscoveredRelationship>;
  readonly errorMessage: string | null;
  readonly durationMs: number;
  readonly stdout: string;
}

function bullet(s: string): string {
  return `- ${s}`;
}

export function renderDiscoveryArtifact(inputs: ArtifactInputs): string {
  const {
    recruitingPool,
    applyingPool,
    status,
    summary,
    relationships,
    errorMessage,
    durationMs,
    stdout,
  } = inputs;

  const meta: string[] = [
    bullet(`recruitingPoolSize: ${recruitingPool.length}`),
    bullet(`applyingPoolSize: ${applyingPool.length}`),
    bullet(`status: ${status}`),
    bullet(`durationMs: ${durationMs}`),
    bullet(`relationshipCount: ${relationships.length}`),
    bullet(`errorMessage: ${errorMessage ?? NONE}`),
  ];

  const recruitingLines: string[] = [`## Recruiting Pool (${recruitingPool.length})`];
  for (const r of recruitingPool) {
    recruitingLines.push(`### ${r.id}`);
    recruitingLines.push('```');
    recruitingLines.push(r.material);
    recruitingLines.push('```');
    recruitingLines.push('');
  }

  const applyingLines: string[] = [`## Applying Pool (${applyingPool.length})`];
  for (const a of applyingPool) {
    applyingLines.push(`### ${a.id}`);
    applyingLines.push('```');
    applyingLines.push(a.material);
    applyingLines.push('```');
    applyingLines.push('');
  }

  const summaryLines: string[] = [`## Agent Summary`];
  if (summary === null) {
    summaryLines.push('_No summary returned by the Agent._');
  } else {
    summaryLines.push(summary);
  }

  const relLines: string[] = [`## Discovered Relationships (${relationships.length})`];
  if (relationships.length === 0) {
    relLines.push('_No relationships were proposed by the Agent._');
  } else {
    for (const r of relationships) {
      relLines.push(`### ${r.recruitingId} ↔ ${r.applyingId} — ${r.judgment}`);
      relLines.push('');
      relLines.push(`**analysis**`);
      relLines.push(r.analysis);
      relLines.push('');
      relLines.push(`**evidence**`);
      if (r.evidence.length === 0) relLines.push('_empty_');
      else for (const e of r.evidence) relLines.push(bullet(e));
      relLines.push('');
      relLines.push(`**unknowns**`);
      if (r.unknowns.length === 0) relLines.push('_empty_');
      else for (const u of r.unknowns) relLines.push(bullet(u));
      relLines.push('');
      relLines.push(`**nextStep**`);
      relLines.push(r.nextStep);
      relLines.push('');
    }
  }

  const sections: string[] = [
    `# Relationship Discovery`,
    `## Run Metadata`,
    meta.join('\n'),
    ...recruitingLines,
    ...applyingLines,
    ...summaryLines,
    ...relLines,
  ];

  if (status === 'failed') {
    sections.push(`## Raw output (debug)`);
    sections.push('```');
    sections.push(stdout);
    sections.push('```');
  }

  return sections.join('\n') + '\n';
}

export function writeDiscoveryArtifact(inputs: ArtifactInputs): string {
  const dir = resolve(process.cwd(), 'artifacts', 'discovery');
  mkdirSync(dir, { recursive: true });
  const safeTimestamp = new Date().toISOString().replace(/[:.]/g, '-');
  const filePath = resolve(dir, `${safeTimestamp}_discovery.md`);
  writeFileSync(filePath, renderDiscoveryArtifact(inputs), 'utf-8');
  return filePath;
}
