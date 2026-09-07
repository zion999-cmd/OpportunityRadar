import { HermesSubprocessClient } from '../runtime/hermes/subprocess-client.js';
import { RAW_A, RAW_B } from './cases.js';
import { buildCompletionPrompt, buildRelationshipPrompt } from './prompt.js';
import {
  parseCompletionOutput,
  parseRelationshipOutput,
  type CompletionOutput,
  type RelationshipOutput,
} from './parse.js';
import {
  writeSemanticCompletionArtifact,
  type CompletionStepResult,
  type RelationshipStepResult,
} from './artifact.js';

// semantic-completion/run.ts — three sequential Hermes one-shots.
//
//   Step 1: completion A    (raw A → 3-region completion)
//   Step 2: completion B    (raw B → 3-region completion)
//   Step 3: relationship    (A raw + A completion + B raw + B completion
//                            → 2-region relationship reasoning)
//
// This is the ONLY file in `semantic-completion/*` that imports
// from `runtime/hermes/*`. Everything else in this directory is
// Hermes-agnostic.
//
// Public API:
//
//   runSemanticCompletion()         — legacy Kafka→RabbitMQ case (preserved).
//   runAllCrossDomainCases(cases)   — iterate a list of CaseSpec and produce
//                                      one artifact per case. The case list
//                                      comes from `cross-domain-cases.ts`.
//
// Each case is independently parameterised: it carries its own
// rawA, rawB, title, and optional caseId. The caseId, if
// provided, is included in the artifact filename so 3 case
// runs in the same session do not collide.

export interface CaseSpec {
  readonly rawA: string;
  readonly rawB: string;
  readonly title: string;
  readonly caseId?: string;
}

export interface CaseRunOutcome {
  readonly caseId: string | null;
  readonly status: 'succeeded' | 'failed';
  readonly errorMessage: string | null;
  readonly totalDurationMs: number;
  readonly artifactPath: string;
}

export interface BatchRunOutcome {
  readonly cases: ReadonlyArray<CaseRunOutcome>;
  readonly totalDurationMs: number;
}

export async function runOneCase(spec: CaseSpec): Promise<CaseRunOutcome> {
  const started = Date.now();
  const client = new HermesSubprocessClient();

  // Step 1 — completion A
  const tA = Date.now();
  let completionA: CompletionOutput | null = null;
  let statusA: CompletionStepResult['status'] = 'succeeded';
  let errorA: string | null = null;
  let stdoutA = '';
  try {
    const res = await client.oneShot({
      prompt: buildCompletionPrompt('A', spec.rawA),
      safeMode: true,
    });
    stdoutA = res.stdout;
    completionA = parseCompletionOutput(res.stdout);
  } catch (err) {
    statusA = 'failed';
    errorA = err instanceof Error ? err.message : String(err);
  }
  const durationA = Date.now() - tA;

  // Step 2 — completion B
  const tB = Date.now();
  let completionB: CompletionOutput | null = null;
  let statusB: CompletionStepResult['status'] = 'succeeded';
  let errorB: string | null = null;
  let stdoutB = '';
  try {
    const res = await client.oneShot({
      prompt: buildCompletionPrompt('B', spec.rawB),
      safeMode: true,
    });
    stdoutB = res.stdout;
    completionB = parseCompletionOutput(res.stdout);
  } catch (err) {
    statusB = 'failed';
    errorB = err instanceof Error ? err.message : String(err);
  }
  const durationB = Date.now() - tB;

  // Step 3 — relationship (only if both completions parsed)
  const tR = Date.now();
  let relationship: RelationshipOutput | null = null;
  let statusR: RelationshipStepResult['status'] = 'skipped';
  let errorR: string | null =
    'skipped: a prior step did not produce a parseable completion';
  let stdoutR = '';
  if (completionA !== null && completionB !== null) {
    statusR = 'succeeded';
    errorR = null;
    try {
      const res = await client.oneShot({
        prompt: buildRelationshipPrompt(
          spec.rawA,
          completionA,
          spec.rawB,
          completionB,
        ),
        safeMode: true,
      });
      stdoutR = res.stdout;
      relationship = parseRelationshipOutput(res.stdout);
    } catch (err) {
      statusR = 'failed';
      errorR = err instanceof Error ? err.message : String(err);
    }
  }
  const durationR = Date.now() - tR;

  const totalDurationMs = Date.now() - started;
  const overallStatus: 'succeeded' | 'failed' =
    statusA === 'succeeded' && statusB === 'succeeded' && statusR === 'succeeded'
      ? 'succeeded'
      : 'failed';
  const overallError =
    overallStatus === 'succeeded'
      ? null
      : (errorA ?? errorB ?? errorR ?? 'unknown');

  const completionAStep: CompletionStepResult = {
    status: statusA,
    durationMs: durationA,
    errorMessage: errorA,
    stdout: stdoutA,
    completion: completionA,
  };
  const completionBStep: CompletionStepResult = {
    status: statusB,
    durationMs: durationB,
    errorMessage: errorB,
    stdout: stdoutB,
    completion: completionB,
  };
  const relationshipStep: RelationshipStepResult = {
    status: statusR,
    durationMs: durationR,
    errorMessage: errorR,
    stdout: stdoutR,
    relationship: relationship,
  };

  const artifactPath = writeSemanticCompletionArtifact({
    rawA: spec.rawA,
    rawB: spec.rawB,
    completionA: completionAStep,
    completionB: completionBStep,
    relationship: relationshipStep,
    totalDurationMs,
    status: overallStatus,
    errorMessage: overallError,
    title: spec.title,
    caseId: spec.caseId,
  });

  return {
    caseId: spec.caseId ?? null,
    status: overallStatus,
    errorMessage: overallError,
    totalDurationMs,
    artifactPath,
  };
}

export async function runAllCrossDomainCases(
  cases: ReadonlyArray<CaseSpec>,
): Promise<BatchRunOutcome> {
  const started = Date.now();
  const outcomes: CaseRunOutcome[] = [];
  for (const spec of cases) {
    const outcome = await runOneCase(spec);
    outcomes.push(outcome);
  }
  return { cases: outcomes, totalDurationMs: Date.now() - started };
}

// legacy: preserved Kafka→RabbitMQ case. Same inputs, same prompt
// contract, same artifact filename pattern (no caseId in the
// filename). New runs from this entry point are byte-compatible
// with the v2 boundary artifact.
export interface SemanticCompletionRunOutcome {
  readonly status: 'succeeded' | 'failed';
  readonly errorMessage: string | null;
  readonly totalDurationMs: number;
  readonly artifactPath: string;
}

export async function runSemanticCompletion(): Promise<SemanticCompletionRunOutcome> {
  const outcome = await runOneCase({
    rawA: RAW_A,
    rawB: RAW_B,
    title: 'Semantic Completion — Kafka→RabbitMQ Cross-Surface',
    // no caseId → legacy filename pattern
  });
  return {
    status: outcome.status,
    errorMessage: outcome.errorMessage,
    totalDurationMs: outcome.totalDurationMs,
    artifactPath: outcome.artifactPath,
  };
}
