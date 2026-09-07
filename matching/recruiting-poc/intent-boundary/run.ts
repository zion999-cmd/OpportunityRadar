import { HermesSubprocessClient } from '../../../runtime/hermes/subprocess-client.js';
import { buildIntentBoundaryPrompt } from './prompt.js';
import {
  parseIntentBoundaryOutput,
  type IntentBoundaryOutput,
} from './parse.js';
import { writeIntentBoundaryArtifact } from './artifact.js';
import type { FullPoolDiscoveredRelationship } from '../parse.js';

// matching/recruiting-poc/intent-boundary/run.ts —
// single one-shot intent-boundary question run.
//
// Closed loop:
//
//   Stage 1 recovered relationships
//     ↓ buildIntentBoundaryPrompt
//     ↓ HermesSubprocessClient.oneShot (ONE call, no retry)
//     ↓ parseIntentBoundaryOutput (Zod)
//     ↓ writeIntentBoundaryArtifact
//     → artifacts/recruiting-poc/<ts>_recruiting-poc-intent-boundary.md
//
// Per Stage 2 §F: 1 Hermes invocation total. If the
// invocation or the parse fails, the artifact is written
// with `status: failed` and a Raw output section. There is
// no retry, no second invocation, no follow-up question to
// the model.
//
// This module owns the stage-2 budget. Callers that need to
// loop (e.g. to ask a follow-up question once the employer
// answers) must come back as a future Proposal.

export interface IntentBoundaryRunInput {
  readonly discoveredRelationships: ReadonlyArray<FullPoolDiscoveredRelationship>;
}

export interface IntentBoundaryRunOutcome {
  readonly status: 'succeeded' | 'failed';
  readonly intentBoundary: IntentBoundaryOutput | null;
  readonly errorMessage: string | null;
  readonly durationMs: number;
  readonly artifactPath: string;
  readonly hermesInvocations: 0 | 1;
}

export async function runRecruitingPocIntentBoundary(
  input: IntentBoundaryRunInput,
): Promise<IntentBoundaryRunOutcome> {
  const started = Date.now();
  const prompt = buildIntentBoundaryPrompt(input);
  let status: 'succeeded' | 'failed' = 'succeeded';
  let intentBoundary: IntentBoundaryOutput | null = null;
  let errorMessage: string | null = null;
  let stdout = '';
  let invocations: 0 | 1 = 0;
  try {
    const client = new HermesSubprocessClient();
    const res = await client.oneShot({ prompt, safeMode: true });
    invocations = 1;
    stdout = res.stdout;
    intentBoundary = parseIntentBoundaryOutput(res.stdout);
  } catch (err) {
    status = 'failed';
    errorMessage = err instanceof Error ? err.message : String(err);
  }
  const durationMs = Date.now() - started;
  const artifactPath = writeIntentBoundaryArtifact({
    status,
    discoveredRelationships: input.discoveredRelationships,
    intentBoundary,
    errorMessage,
    durationMs,
    stdout,
  });
  return {
    status,
    intentBoundary,
    errorMessage,
    durationMs,
    artifactPath,
    hermesInvocations: invocations,
  };
}
