import { readFileSync, readdirSync, existsSync } from 'node:fs';
import { resolve } from 'node:path';
import { runIntentUpdate } from '../matching/recruiting-poc/intent-update/run.js';
import { computeRelationshipSpaceDiff } from '../matching/recruiting-poc/intent-update/diff.js';
import { writeIntentUpdateArtifact } from '../matching/recruiting-poc/intent-update/artifact.js';
import {
  parseFullPoolDiscoveryOutput,
  type FullPoolDiscoveryOutput,
} from '../matching/recruiting-poc/parse.js';
import { RAW_OUTPUT_HEADING } from '../matching/recruiting-poc/recover.js';

// scripts/recruiting-poc-intent-update-cli.ts —
// CLI wrapper that runs the Stage 3 counterfactual
// experiment:
//
//   1. Read the recovered Stage 1 artifact's relationships
//      (used as the baseline; Stage 1 judgments are NOT
//      fed to the model — they are only used by the
//      deterministic diff at the end).
//   2. Run A: 1 Hermes one-shot with Answer A.
//   3. Run B: 1 Hermes one-shot with Answer B.
//   4. Compute the deterministic set diff.
//   5. Write the Stage 3 artifact (11 sections).
//
// Budget: exactly 2 Hermes invocations (one per run).
// No retry. If one run's parse or invocation fails, the
// other run continues and the artifact is still written
// with `status: failed` for the failing run and a saved
// raw output section. No second call is made.
//
// Usage:
//   npm run recruiting-poc-intent-update-cli
//   npm run recruiting-poc-intent-update-cli -- <stage1-recovered-artifact>

function listRecoveredStage1Artifacts(): string[] {
  const dir = resolve(process.cwd(), 'artifacts', 'recruiting-poc');
  if (!existsSync(dir)) return [];
  return readdirSync(dir)
    .filter((n) => n.endsWith('_recruiting-poc-discovery.recovered.md'))
    .sort();
}

function readRelationshipsFromRecoveredArtifact(
  artifactPath: string,
): FullPoolDiscoveryOutput {
  const body = readFileSync(artifactPath, 'utf-8');
  const sourceIdx = body.indexOf('source: ');
  if (sourceIdx < 0) {
    throw new Error(
      `intent-update-cli: recovered artifact ${artifactPath} has no "source:" line in metadata`,
    );
  }
  const lineStart = body.lastIndexOf('\n', sourceIdx) + 1;
  const lineEnd = body.indexOf('\n', sourceIdx);
  const sourceLine = body
    .slice(lineStart, lineEnd < 0 ? body.length : lineEnd)
    .trim();
  const sourcePath = sourceLine
    .replace(/^-\s+/, '')
    .replace(/^source:\s*/, '')
    .trim();
  if (!existsSync(sourcePath)) {
    throw new Error(
      `intent-update-cli: source artifact ${sourcePath} no longer exists`,
    );
  }
  const sourceBody = readFileSync(sourcePath, 'utf-8');
  const stdoutStart = sourceBody.indexOf(RAW_OUTPUT_HEADING);
  if (stdoutStart < 0) {
    throw new Error(
      `intent-update-cli: source artifact ${sourcePath} has no "${RAW_OUTPUT_HEADING}" section`,
    );
  }
  const afterHeading = sourceBody.slice(stdoutStart + RAW_OUTPUT_HEADING.length);
  const fenceOpen = afterHeading.indexOf('```');
  if (fenceOpen < 0) {
    throw new Error(
      `intent-update-cli: source artifact ${sourcePath} raw output has no opening fence`,
    );
  }
  let contentStart = fenceOpen + 3;
  if (afterHeading[contentStart] === '\n') contentStart += 1;
  const rest = afterHeading.slice(contentStart);
  const fenceClose = rest.lastIndexOf('```');
  if (fenceClose < 0) {
    throw new Error(
      `intent-update-cli: source artifact ${sourcePath} raw output has no closing fence`,
    );
  }
  let contentEnd = fenceClose;
  if (contentEnd > 0 && rest[contentEnd - 1] === '\n') contentEnd -= 1;
  const stdout = rest.slice(0, contentEnd);
  return parseFullPoolDiscoveryOutput(stdout);
}

async function main(): Promise<void> {
  const args = process.argv.slice(2);
  const provided = args[0];

  let stage1ArtifactPath: string;
  if (provided !== undefined && provided.length > 0) {
    stage1ArtifactPath = resolve(provided);
  } else {
    const candidates = listRecoveredStage1Artifacts();
    if (candidates.length === 0) {
      process.stderr.write(
        'intent-update-cli: no recovered Stage 1 artifact found under artifacts/recruiting-poc/. Run `npm run recruiting-poc-recover-cli -- <failed-artifact>` first.\n',
      );
      process.exit(2);
    }
    stage1ArtifactPath = resolve(
      process.cwd(),
      'artifacts',
      'recruiting-poc',
      candidates[candidates.length - 1] as string,
    );
  }

  process.stdout.write(
    `intent-update-cli: stage1Artifact=${stage1ArtifactPath}\n`,
  );

  const stage1 = readRelationshipsFromRecoveredArtifact(stage1ArtifactPath);
  process.stdout.write(
    `intent-update-cli: baselineRelationshipCount=${stage1.relationships.length}\n`,
  );

  // Run A — 1 Hermes invocation.
  const runA = await runIntentUpdate('A');
  process.stdout.write(
    `intent-update-cli: runA status=${runA.status} durationMs=${runA.durationMs} hermesInvocations=${runA.hermesInvocations} relationshipCount=${runA.relationships.length}\n`,
  );
  if (runA.status === 'failed') {
    process.stdout.write(
      `intent-update-cli: runA errorMessage=${runA.errorMessage}\n`,
    );
  }

  // Run B — 1 Hermes invocation. Run A's outcome does NOT
  // influence Run B's prompt; the two runs are independent
  // by construction (separate Hermes subprocesses; no
  // prompt tuning after seeing Run A's result).
  const runB = await runIntentUpdate('B');
  process.stdout.write(
    `intent-update-cli: runB status=${runB.status} durationMs=${runB.durationMs} hermesInvocations=${runB.hermesInvocations} relationshipCount=${runB.relationships.length}\n`,
  );
  if (runB.status === 'failed') {
    process.stdout.write(
      `intent-update-cli: runB errorMessage=${runB.errorMessage}\n`,
    );
  }

  const diff = computeRelationshipSpaceDiff(
    stage1.relationships,
    runA.relationships,
    runB.relationships,
  );

  const artifactPath = writeIntentUpdateArtifact({
    baseline: stage1.relationships,
    runA: {
      status: runA.status,
      summary: runA.summary,
      relationships: runA.relationships,
      errorMessage: runA.errorMessage,
      durationMs: runA.durationMs,
      stdout: runA.stdout,
      hermesInvocations: runA.hermesInvocations,
    },
    runB: {
      status: runB.status,
      summary: runB.summary,
      relationships: runB.relationships,
      errorMessage: runB.errorMessage,
      durationMs: runB.durationMs,
      stdout: runB.stdout,
      hermesInvocations: runB.hermesInvocations,
    },
    diff,
  });

  process.stdout.write(
    `\nintent-update-cli: artifact=${artifactPath}\n`,
  );
  process.stdout.write(
    `intent-update-cli: surfacedInBaseline=${diff.surfacedInBaseline.join(',')}\n`,
  );
  process.stdout.write(
    `intent-update-cli: surfacedInA=${diff.surfacedInA.join(',')}\n`,
  );
  process.stdout.write(
    `intent-update-cli: surfacedInB=${diff.surfacedInB.join(',')}\n`,
  );
  process.stdout.write(
    `intent-update-cli: addedInA=${diff.addedInA.join(',')} removedInA=${diff.removedInA.join(',')}\n`,
  );
  process.stdout.write(
    `intent-update-cli: addedInB=${diff.addedInB.join(',')} removedInB=${diff.removedInB.join(',')}\n`,
  );
  process.stdout.write(
    `intent-update-cli: judgmentChangedInA=${diff.judgmentChangedInA.join(',')} judgmentChangedInB=${diff.judgmentChangedInB.join(',')}\n`,
  );

  if (runA.status === 'failed' && runB.status === 'failed') {
    process.exit(1);
  }
}

main().catch((err) => {
  process.stderr.write(
    `intent-update-cli: ${err instanceof Error ? err.message : String(err)}\n`,
  );
  process.exit(1);
});
