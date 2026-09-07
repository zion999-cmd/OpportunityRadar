import { mkdirSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import type { RelationJudgment } from './relation-judgment.js';

// matching/artifact.ts — render and write the per-case
// human-readable Markdown artifact.
//
// Pure: no DB, no Runtime, no globals. The caller passes the
// inputs (case + outcome); this module renders to a string and
// (separately) writes the string to disk. The renderer is
// testable in isolation; the writer is a one-liner around
// `writeFileSync`.

const NONE = '—';

export interface ArtifactInputs {
  readonly caseId: string;
  readonly label: string;
  readonly notes: string;
  readonly recruitingMaterial: string;
  readonly applyingMaterial: string;
  readonly status: 'succeeded' | 'failed';
  readonly judgment: RelationJudgment | null;
  readonly errorMessage: string | null;
  readonly durationMs: number;
  readonly stdout: string;
}

function bullet(s: string): string {
  return `- ${s}`;
}

export function renderMatchingArtifact(inputs: ArtifactInputs): string {
  const {
    caseId,
    label,
    notes,
    recruitingMaterial,
    applyingMaterial,
    status,
    judgment,
    errorMessage,
    durationMs,
    stdout,
  } = inputs;

  const meta: string[] = [
    bullet(`id: ${caseId}`),
    bullet(`label: ${label}`),
    bullet(`notes: ${notes}`),
    bullet(`status: ${status}`),
    bullet(`durationMs: ${durationMs}`),
    bullet(`errorMessage: ${errorMessage ?? NONE}`),
  ];

  const judgmentBlock: string[] = [];
  if (judgment === null) {
    judgmentBlock.push('_No judgment was produced._');
  } else {
    judgmentBlock.push(bullet(`kind: ${judgment.judgment}`));
    judgmentBlock.push('');
    judgmentBlock.push(`**analysis**`);
    judgmentBlock.push(judgment.analysis);
    judgmentBlock.push('');
    judgmentBlock.push(`**evidence**`);
    if (judgment.evidence.length === 0) judgmentBlock.push('_empty_');
    else for (const e of judgment.evidence) judgmentBlock.push(bullet(e));
    judgmentBlock.push('');
    judgmentBlock.push(`**unknowns**`);
    if (judgment.unknowns.length === 0) judgmentBlock.push('_empty_');
    else for (const u of judgment.unknowns) judgmentBlock.push(bullet(u));
    judgmentBlock.push('');
    judgmentBlock.push(`**nextStep**`);
    judgmentBlock.push(judgment.nextStep);
  }

  const sections: string[] = [
    `# Matching — ${caseId}`,
    `## Case`,
    meta.join('\n'),
    `## Recruiting material`,
    '```',
    recruitingMaterial,
    '```',
    `## Applying material`,
    '```',
    applyingMaterial,
    '```',
    `## Judgment`,
    ...judgmentBlock,
  ];

  if (status === 'failed') {
    sections.push(`## Raw output (debug)`);
    sections.push('```');
    sections.push(stdout);
    sections.push('```');
  }

  return sections.join('\n\n') + '\n';
}

export function writeMatchingArtifact(inputs: ArtifactInputs): string {
  const dir = resolve(process.cwd(), 'artifacts', 'matching');
  mkdirSync(dir, { recursive: true });
  const safeTimestamp = new Date().toISOString().replace(/[:.]/g, '-');
  const filePath = resolve(dir, `${safeTimestamp}_${inputs.caseId}.md`);
  writeFileSync(filePath, renderMatchingArtifact(inputs), 'utf-8');
  return filePath;
}
