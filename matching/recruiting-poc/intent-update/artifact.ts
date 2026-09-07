import { mkdirSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { EMPLOYER_RAW_SITUATION } from '../cases.js';
import {
  STAGE2_INTENT_BOUNDARY_QUESTION,
  ANSWER_A_VERBATIM,
  ANSWER_B_VERBATIM,
} from './answers.js';
import type { FullPoolDiscoveredRelationship } from '../parse.js';
import type { RelationshipSpaceDiff } from './diff.js';

// matching/recruiting-poc/intent-update/artifact.ts —
// render and write the per-run human-readable Markdown
// research artifact for the Stage 3 counterfactual
// experiment.
//
// Sections (per Stage 3 §7), in order:
//   1.  Original Employer Raw Situation
//   2.  Stage 2 Intent Boundary Question
//   3.  Answer A
//   4.  Run A Relationships
//   5.  Answer B
//   6.  Run B Relationships
//   7.  Stage 1 Baseline Relationships
//   8.  Deterministic Relationship-Space Diff
//   9.  Runtime Metadata
//   10. Raw Output A
//   11. Raw Output B
//
// Raw Output A / Raw Output B are included as appendix
// sections regardless of success/failure, so the experiment
// is fully reproducible from the artifact alone. The full
// Hermes stdout is preserved verbatim.

const NONE = '—';

export interface IntentUpdateRunBlock {
  readonly status: 'succeeded' | 'failed';
  readonly summary: string | null;
  readonly relationships: ReadonlyArray<FullPoolDiscoveredRelationship>;
  readonly errorMessage: string | null;
  readonly durationMs: number;
  readonly stdout: string;
  readonly hermesInvocations: 0 | 1;
}

export interface IntentUpdateArtifactInputs {
  readonly baseline: ReadonlyArray<FullPoolDiscoveredRelationship>;
  readonly runA: IntentUpdateRunBlock;
  readonly runB: IntentUpdateRunBlock;
  readonly diff: RelationshipSpaceDiff;
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
  lines.push('**nextStep**');
  lines.push(rel.nextStep);
  lines.push('');
  return lines.join('\n');
}

function renderRun(
  label: 'A' | 'B',
  run: IntentUpdateRunBlock,
): string[] {
  const lines: string[] = [
    `### Status: ${run.status}`,
    `Duration: ${run.durationMs} ms`,
    `Hermes invocations: ${run.hermesInvocations}`,
    run.errorMessage === null ? '' : `Error: ${run.errorMessage}`,
    '',
    '**summary**',
    run.summary ?? '_—_',
    '',
    `**relationships (${run.relationships.length})**`,
    '',
  ];
  if (run.relationships.length === 0) {
    lines.push('_No relationships were surfaced._');
    lines.push('');
  } else {
    for (const r of run.relationships) {
      lines.push(renderRelationship(r));
    }
  }
  void label;
  return lines;
}

function renderDiffBlock(
  title: string,
  ids: ReadonlyArray<string>,
): string {
  if (ids.length === 0) return `${title}: (empty)`;
  return `${title}: ${ids.join(', ')}`;
}

export function renderIntentUpdateArtifact(
  inputs: IntentUpdateArtifactInputs,
): string {
  const { baseline, runA, runB, diff } = inputs;

  const sections: string[] = [
    '# Semantic Native Recruiting POC v0 — Stage 3: Intent Update → Relationship Space Change',
    '',
    '> Counterfactual experiment. Two independent full-pool discovery runs, each with one of two mutually exclusive counterfactual employer answers appended as raw intent evidence. No schema / filter / tag conversion. No prompt tuning after seeing results. Comparison is deterministic set operations only.',
    '',
    '## 1. Original Employer Raw Situation',
    '> Verbatim. No pre-conversion to job schema, skills list, tags, or filter conditions.',
    '',
    '```',
    EMPLOYER_RAW_SITUATION,
    '```',
    '',
    '## 2. Stage 2 Intent Boundary Question',
    '> Fixed at Stage 3. Not regenerated. The question Stage 3 builds on.',
    '',
    STAGE2_INTENT_BOUNDARY_QUESTION,
    '',
    '## 3. Answer A',
    '> Counterfactual Answer A. Stored as raw text; not converted to fields, filters, or tags.',
    '',
    '```',
    ANSWER_A_VERBATIM,
    '```',
    '',
    '## 4. Run A Relationships',
    '> Single full-pool discovery Hermes one-shot with Original Situation + Answer A + same 20 candidates.',
    '',
    ...renderRun('A', runA),
    '',
    '## 5. Answer B',
    '> Counterfactual Answer B. Stored as raw text; not converted to fields, filters, or tags.',
    '',
    '```',
    ANSWER_B_VERBATIM,
    '```',
    '',
    '## 6. Run B Relationships',
    '> Single full-pool discovery Hermes one-shot with Original Situation + Answer B + same 20 candidates.',
    '',
    ...renderRun('B', runB),
    '',
    '## 7. Stage 1 Baseline Relationships',
    '> Recovered from the original Stage 1 oracle run; no new relationship judgments are produced at this stage.',
    '',
  ];
  if (baseline.length === 0) {
    sections.push('_No baseline relationships._');
    sections.push('');
  } else {
    for (const r of baseline) {
      sections.push(renderRelationship(r));
    }
  }

  sections.push('## 8. Deterministic Relationship-Space Diff');
  sections.push('> Set operations on (id, judgment) pairs. No score, no LLM, no interpretation.');
  sections.push('');
  sections.push(renderDiffBlock('surfacedInBaseline', diff.surfacedInBaseline));
  sections.push(renderDiffBlock('surfacedInA', diff.surfacedInA));
  sections.push(renderDiffBlock('surfacedInB', diff.surfacedInB));
  sections.push('');
  sections.push(renderDiffBlock('addedInA', diff.addedInA));
  sections.push(renderDiffBlock('removedInA', diff.removedInA));
  sections.push('');
  sections.push(renderDiffBlock('addedInB', diff.addedInB));
  sections.push(renderDiffBlock('removedInB', diff.removedInB));
  sections.push('');
  sections.push(renderDiffBlock('judgmentChangedInA', diff.judgmentChangedInA));
  sections.push(renderDiffBlock('judgmentChangedInB', diff.judgmentChangedInB));
  sections.push('');

  const totalDurationMs = runA.durationMs + runB.durationMs;
  const totalHermesInvocations = runA.hermesInvocations + runB.hermesInvocations;
  const meta: string[] = [
    bullet('stage: 3 of 3 (Intent Update → Relationship Space Change)'),
    bullet('method: two independent full-pool discovery Hermes one-shots, same prompt template parameterized by answer A or B'),
    bullet('runtime: hermes via HermesSubprocessClient (oneshot-runner.py)'),
    bullet('comparison: deterministic set operations on (id, judgment) pairs; no LLM, no score, no interpretation'),
    bullet(`runA: status=${runA.status} durationMs=${runA.durationMs} relationshipCount=${runA.relationships.length} hermesInvocations=${runA.hermesInvocations}`),
    bullet(`runA: errorMessage=${runA.errorMessage ?? NONE}`),
    bullet(`runB: status=${runB.status} durationMs=${runB.durationMs} relationshipCount=${runB.relationships.length} hermesInvocations=${runB.hermesInvocations}`),
    bullet(`runB: errorMessage=${runB.errorMessage ?? NONE}`),
    bullet(`totalDurationMs: ${totalDurationMs}`),
    bullet(`hermesInvocations: ${totalHermesInvocations} (Run A + Run B, fixed budget = 2)`),
    bullet(`baselineRelationshipCount: ${baseline.length}`),
    bullet(`addedInACount: ${diff.addedInA.length}`),
    bullet(`removedInACount: ${diff.removedInA.length}`),
    bullet(`addedInBCount: ${diff.addedInB.length}`),
    bullet(`removedInBCount: ${diff.removedInB.length}`),
    bullet(`judgmentChangedInACount: ${diff.judgmentChangedInA.length}`),
    bullet(`judgmentChangedInBCount: ${diff.judgmentChangedInB.length}`),
  ];

  sections.push('## 9. Runtime Metadata');
  sections.push(meta.join('\n'));
  sections.push('');

  sections.push('## 10. Raw Output A');
  sections.push('```');
  sections.push(runA.stdout.length === 0 ? '_empty_' : runA.stdout);
  sections.push('```');
  sections.push('');

  sections.push('## 11. Raw Output B');
  sections.push('```');
  sections.push(runB.stdout.length === 0 ? '_empty_' : runB.stdout);
  sections.push('```');
  sections.push('');

  return sections.join('\n');
}

export function writeIntentUpdateArtifact(
  inputs: IntentUpdateArtifactInputs,
): string {
  const dir = resolve(process.cwd(), 'artifacts', 'recruiting-poc');
  mkdirSync(dir, { recursive: true });
  const safeTimestamp = new Date().toISOString().replace(/[:.]/g, '-');
  const fileName = `${safeTimestamp}_recruiting-poc-intent-update.md`;
  const filePath = resolve(dir, fileName);
  writeFileSync(filePath, renderIntentUpdateArtifact(inputs), 'utf-8');
  return filePath;
}
