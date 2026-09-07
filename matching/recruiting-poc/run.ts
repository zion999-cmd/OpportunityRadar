import { HermesSubprocessClient } from '../../runtime/hermes/subprocess-client.js';
import { buildFullPoolDiscoveryPrompt } from './prompt.js';
import {
  parseFullPoolDiscoveryOutput,
  type FullPoolDiscoveredRelationship,
} from './parse.js';
import { writeFullPoolDiscoveryArtifact } from './artifact.js';

// matching/recruiting-poc/run.ts — single one-shot full-pool
// discovery run.
//
// Closed loop:
//
//   1 Employer Raw Situation
//   + 20 Candidate Raw Experiences
//     ↓ buildFullPoolDiscoveryPrompt
//     ↓ HermesSubprocessClient.oneShot
//     ↓ parseFullPoolDiscoveryOutput (Zod, 0..N relationships)
//     ↓ writeFullPoolDiscoveryArtifact
//     → artifacts/recruiting-poc/<ts>_recruiting-poc-discovery.md
//
// This is the ONLY file in `matching/recruiting-poc/*` that
// imports from `runtime/hermes/*`. Everything else in this
// directory is Hermes-agnostic.

export interface FullPoolDiscoveryRunOutcome {
  readonly status: 'succeeded' | 'failed';
  readonly summary: string | null;
  readonly relationships: ReadonlyArray<FullPoolDiscoveredRelationship>;
  readonly errorMessage: string | null;
  readonly durationMs: number;
  readonly artifactPath: string;
}

export async function runRecruitingPocFullPoolDiscovery(): Promise<FullPoolDiscoveryRunOutcome> {
  const started = Date.now();
  const prompt = buildFullPoolDiscoveryPrompt();
  let status: 'succeeded' | 'failed' = 'succeeded';
  let summary: string | null = null;
  let relationships: ReadonlyArray<FullPoolDiscoveredRelationship> = [];
  let errorMessage: string | null = null;
  let stdout = '';
  try {
    const client = new HermesSubprocessClient();
    const res = await client.oneShot({ prompt, safeMode: true });
    stdout = res.stdout;
    const parsed = parseFullPoolDiscoveryOutput(res.stdout);
    summary = parsed.summary;
    relationships = parsed.relationships;
  } catch (err) {
    status = 'failed';
    errorMessage = err instanceof Error ? err.message : String(err);
  }
  const durationMs = Date.now() - started;
  const artifactPath = writeFullPoolDiscoveryArtifact({
    status,
    summary,
    relationships,
    errorMessage,
    durationMs,
    stdout,
    recoveryNote: null,
    recoverySourcePath: null,
  });
  return { status, summary, relationships, errorMessage, durationMs, artifactPath };
}
