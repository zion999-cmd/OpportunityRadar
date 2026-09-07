import { HermesSubprocessClient } from '../runtime/hermes/subprocess-client.js';
import type { MatchingCase } from './cases.js';
import { buildMatchingPrompt } from './prompt.js';
import { parseMatchingOutput } from './parse.js';
import { writeMatchingArtifact } from './artifact.js';
import type { RelationJudgment } from './relation-judgment.js';

// matching/run.ts — one function: take a MatchingCase, run it
// through real Hermes, write an artifact. Returns the outcome.
//
// This is the ONLY place in `matching/` that imports from
// `runtime/hermes/*`. Everything else in `matching/` is
// Hermes-agnostic. Swapping Hermes for a different transport
// later means changing this one file.

export interface MatchingRunOutcome {
  readonly caseId: string;
  readonly label: string;
  readonly status: 'succeeded' | 'failed';
  readonly judgment: RelationJudgment | null;
  readonly errorMessage: string | null;
  readonly durationMs: number;
  readonly artifactPath: string;
}

export async function runCase(c: MatchingCase): Promise<MatchingRunOutcome> {
  const started = Date.now();
  const prompt = buildMatchingPrompt(c);
  let status: 'succeeded' | 'failed' = 'succeeded';
  let judgment: RelationJudgment | null = null;
  let errorMessage: string | null = null;
  let stdout = '';
  try {
    const client = new HermesSubprocessClient();
    const res = await client.oneShot({ prompt, safeMode: true });
    stdout = res.stdout;
    judgment = parseMatchingOutput(res.stdout);
  } catch (err) {
    status = 'failed';
    errorMessage = err instanceof Error ? err.message : String(err);
  }
  const durationMs = Date.now() - started;
  const artifactPath = writeMatchingArtifact({
    caseId: c.id,
    label: c.label,
    notes: c.notes,
    recruitingMaterial: c.recruitingMaterial,
    applyingMaterial: c.applyingMaterial,
    status,
    judgment,
    errorMessage,
    durationMs,
    stdout,
  });
  return {
    caseId: c.id,
    label: c.label,
    status,
    judgment,
    errorMessage,
    durationMs,
    artifactPath,
  };
}
