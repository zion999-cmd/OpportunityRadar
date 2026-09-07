import { HermesSubprocessClient } from '../../runtime/hermes/subprocess-client.js';
import { recruitingPool, applyingPool } from './pools.js';
import { buildDiscoveryPrompt } from './prompt.js';
import { parseDiscoveryOutput, type DiscoveredRelationship } from './parse.js';
import { writeDiscoveryArtifact } from './artifact.js';

// matching/discovery/run.ts — single one-shot discovery run.
//
// The discovery POC validates one closed loop:
//
//   raw recruiting pool (6 materials)
//   + raw applying pool (8 materials)
//     ↓ buildDiscoveryPrompt
//     ↓ HermesSubprocessClient.oneShot
//     ↓ parseDiscoveryOutput (Zod, 0..N relationships)
//     ↓ writeDiscoveryArtifact → artifacts/discovery/<ts>_discovery.md
//
// Hermes sees the two pools at once, decides which pairs (if
// any) are worth exploring, and returns a small JSON with
// `summary` + `relationships[]`. We do NOT exhaustively pair
// every R with every A and rank them; the discovery is the
// model's job.
//
// This is the ONLY file in `matching/discovery/*` that imports
// from `runtime/hermes/*`. Everything else in this directory is
// Hermes-agnostic.

export interface DiscoveryRunOutcome {
  readonly status: 'succeeded' | 'failed';
  readonly summary: string | null;
  readonly relationships: ReadonlyArray<DiscoveredRelationship>;
  readonly errorMessage: string | null;
  readonly durationMs: number;
  readonly artifactPath: string;
}

export async function runDiscovery(): Promise<DiscoveryRunOutcome> {
  const started = Date.now();
  const prompt = buildDiscoveryPrompt({ recruiting: recruitingPool, applying: applyingPool });
  let status: 'succeeded' | 'failed' = 'succeeded';
  let summary: string | null = null;
  let relationships: ReadonlyArray<DiscoveredRelationship> = [];
  let errorMessage: string | null = null;
  let stdout = '';
  try {
    const client = new HermesSubprocessClient();
    const res = await client.oneShot({ prompt, safeMode: true });
    stdout = res.stdout;
    const parsed = parseDiscoveryOutput(res.stdout);
    summary = parsed.summary;
    relationships = parsed.relationships;
  } catch (err) {
    status = 'failed';
    errorMessage = err instanceof Error ? err.message : String(err);
  }
  const durationMs = Date.now() - started;
  const artifactPath = writeDiscoveryArtifact({
    recruitingPool,
    applyingPool,
    status,
    summary,
    relationships,
    errorMessage,
    durationMs,
    stdout,
  });
  return { status, summary, relationships, errorMessage, durationMs, artifactPath };
}
