import { HermesSubprocessClient } from '../../../runtime/hermes/subprocess-client.js';
import { buildIntentUpdatePrompt } from './prompt.js';
import { parseFullPoolDiscoveryOutput } from './parse.js';
import type { FullPoolDiscoveredRelationship } from '../parse.js';
import type { IntentUpdateAnswer } from './answers.js';

// matching/recruiting-poc/intent-update/run.ts —
// single one-shot full-pool discovery run, parameterized by
// counterfactual answer ('A' or 'B').
//
// Closed loop:
//
//   { original Employer Raw Situation }
//   + { one of {Answer A, Answer B} }
//   + { same 20 candidate raw experiences }
//     ↓ buildIntentUpdatePrompt(answer)
//     ↓ HermesSubprocessClient.oneShot          (ONE call, no retry)
//     ↓ parseFullPoolDiscoveryOutput             (Stage 1 Zod schema)
//     → { status, summary, relationships, errorMessage, durationMs, stdout }
//
// Per Stage 3 §8: 1 Hermes invocation per run. No retry.
// If the parse or the invocation fails, the run returns
// status='failed' with errorMessage; the OTHER run is not
// affected and the artifact is still written (Run A and
// Run B are fully independent).
//
// This file is the ONLY file in `intent-update/*` that
// imports from `runtime/hermes/*`. Everything else in this
// module is Hermes-agnostic.

export interface IntentUpdateRunOutcome {
  readonly answer: IntentUpdateAnswer;
  readonly status: 'succeeded' | 'failed';
  readonly summary: string | null;
  readonly relationships: ReadonlyArray<FullPoolDiscoveredRelationship>;
  readonly errorMessage: string | null;
  readonly durationMs: number;
  readonly stdout: string;
  readonly hermesInvocations: 0 | 1;
}

export async function runIntentUpdate(
  answer: IntentUpdateAnswer,
): Promise<IntentUpdateRunOutcome> {
  const started = Date.now();
  const prompt = buildIntentUpdatePrompt(answer);
  let status: 'succeeded' | 'failed' = 'succeeded';
  let summary: string | null = null;
  let relationships: ReadonlyArray<FullPoolDiscoveredRelationship> = [];
  let errorMessage: string | null = null;
  let stdout = '';
  let invocations: 0 | 1 = 0;
  try {
    const client = new HermesSubprocessClient();
    const res = await client.oneShot({ prompt, safeMode: true });
    invocations = 1;
    stdout = res.stdout;
    const parsed = parseFullPoolDiscoveryOutput(res.stdout);
    summary = parsed.summary;
    relationships = parsed.relationships;
  } catch (err) {
    status = 'failed';
    errorMessage = err instanceof Error ? err.message : String(err);
  }
  const durationMs = Date.now() - started;
  return {
    answer,
    status,
    summary,
    relationships,
    errorMessage,
    durationMs,
    stdout,
    hermesInvocations: invocations,
  };
}
