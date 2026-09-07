import { mkdirSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';

// semantic-completion/artifact.ts — render and write the
// human-readable Markdown artifact for this experiment.
//
// Required content (per upstream spec):
//   Raw A
//   Semantic Completion A
//   Raw B
//   Semantic Completion B
//   Relationship Reasoning
//
// Pure: no DB, no Runtime, no globals. The caller passes the
// inputs; this module renders and (separately) writes.

const NONE = '—';

export type StepStatus = 'succeeded' | 'failed' | 'skipped';

export interface StepResultBase {
  readonly status: StepStatus;
  readonly durationMs: number;
  readonly errorMessage: string | null;
  readonly stdout: string;
}

export interface CompletionStepResult extends StepResultBase {
  readonly completion:
    | {
        readonly directlySupported: string;
        readonly impliedMeaning: string;
        readonly hypothesesAndUnknowns: string;
      }
    | null;
}

export interface RelationshipStepResult extends StepResultBase {
  readonly relationship:
    | {
        readonly supportedReasoning: string;
        readonly stillNeedsEvidence: string;
      }
    | null;
}

export interface ArtifactInputs {
  readonly rawA: string;
  readonly rawB: string;
  readonly completionA: CompletionStepResult;
  readonly completionB: CompletionStepResult;
  readonly relationship: RelationshipStepResult;
  readonly totalDurationMs: number;
  readonly status: 'succeeded' | 'failed';
  readonly errorMessage: string | null;
  // Optional cross-domain extensions. The legacy Kafka→RabbitMQ
  // case omits both, and the renderer / writer use the legacy
  // defaults.
  readonly title?: string;
  readonly caseId?: string;
}

function bullet(s: string): string {
  return `- ${s}`;
}

function renderCompletionSection(
  label: 'A' | 'B',
  result: CompletionStepResult,
): string {
  const lines: string[] = [];
  lines.push(`## Semantic Completion ${label}`);
  lines.push('');
  lines.push(bullet(`status: ${result.status}`));
  lines.push(bullet(`durationMs: ${result.durationMs}`));
  lines.push(bullet(`errorMessage: ${result.errorMessage ?? NONE}`));
  if (result.completion === null) {
    lines.push('');
    lines.push('_No completion was parsed from the Agent output._');
  } else {
    lines.push('');
    lines.push('### directly supported');
    lines.push(result.completion.directlySupported);
    lines.push('');
    lines.push('### implied meaning');
    lines.push(result.completion.impliedMeaning);
    lines.push('');
    lines.push('### hypotheses and unknowns');
    lines.push(result.completion.hypothesesAndUnknowns);
  }
  if (result.status === 'failed') {
    lines.push('');
    lines.push('### Raw output (debug)');
    lines.push('```');
    lines.push(result.stdout);
    lines.push('```');
  }
  return lines.join('\n');
}

function renderRelationshipSection(result: RelationshipStepResult): string {
  const lines: string[] = [];
  lines.push('## Relationship Reasoning');
  lines.push('');
  lines.push(bullet(`status: ${result.status}`));
  lines.push(bullet(`durationMs: ${result.durationMs}`));
  lines.push(bullet(`errorMessage: ${result.errorMessage ?? NONE}`));
  if (result.relationship === null) {
    lines.push('');
    lines.push('_No relationship reasoning was parsed from the Agent output._');
  } else {
    lines.push('');
    lines.push('### supported reasoning');
    lines.push(result.relationship.supportedReasoning);
    lines.push('');
    lines.push('### still needs evidence');
    lines.push(result.relationship.stillNeedsEvidence);
  }
  if (result.status === 'failed') {
    lines.push('');
    lines.push('### Raw output (debug)');
    lines.push('```');
    lines.push(result.stdout);
    lines.push('```');
  }
  return lines.join('\n');
}

export function renderSemanticCompletionArtifact(inputs: ArtifactInputs): string {
  const title =
    inputs.title ?? 'Semantic Completion — Kafka→RabbitMQ Cross-Surface';
  const sections: string[] = [];
  sections.push(`# ${title}`);
  sections.push('## Run Metadata');
  sections.push(bullet(`status: ${inputs.status}`));
  sections.push(bullet(`totalDurationMs: ${inputs.totalDurationMs}`));
  sections.push(bullet(`errorMessage: ${inputs.errorMessage ?? NONE}`));
  sections.push('');
  sections.push('## Raw A');
  sections.push('```');
  sections.push(inputs.rawA);
  sections.push('```');
  sections.push('');
  sections.push(renderCompletionSection('A', inputs.completionA));
  sections.push('');
  sections.push('## Raw B');
  sections.push('```');
  sections.push(inputs.rawB);
  sections.push('```');
  sections.push('');
  sections.push(renderCompletionSection('B', inputs.completionB));
  sections.push('');
  sections.push(renderRelationshipSection(inputs.relationship));
  return sections.join('\n') + '\n';
}

export function writeSemanticCompletionArtifact(inputs: ArtifactInputs): string {
  const dir = resolve(process.cwd(), 'artifacts', 'semantic-completion');
  mkdirSync(dir, { recursive: true });
  const safeTimestamp = new Date().toISOString().replace(/[:.]/g, '-');
  const caseIdSegment = inputs.caseId !== undefined ? `_${inputs.caseId}` : '';
  const filePath = resolve(
    dir,
    `${safeTimestamp}${caseIdSegment}_semantic-completion.md`,
  );
  writeFileSync(filePath, renderSemanticCompletionArtifact(inputs), 'utf-8');
  return filePath;
}
