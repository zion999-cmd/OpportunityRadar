import { readFileSync, readdirSync, existsSync } from 'node:fs';
import { resolve } from 'node:path';
import { runRecruitingPocIntentBoundary } from '../matching/recruiting-poc/intent-boundary/run.js';
import {
  parseFullPoolDiscoveryOutput,
  type FullPoolDiscoveryOutput,
} from '../matching/recruiting-poc/parse.js';
import { RAW_OUTPUT_HEADING } from '../matching/recruiting-poc/recover.js';

// scripts/recruiting-poc-intent-boundary-cli.ts —
// CLI wrapper around runRecruitingPocIntentBoundary.
//
// Usage:
//   npm run recruiting-poc-intent-boundary-cli
//   npm run recruiting-poc-intent-boundary-cli -- <stage1-recovered-artifact>
//
// When no path is provided, the CLI finds the most recent
// `*_recruiting-poc-discovery.recovered.md` under
// `artifacts/recruiting-poc/` and uses its parsed
// `relationships` as the Stage 1 input to the Intent
// Boundary prompt.
//
// Exactly one Hermes invocation. If the invocation or the
// parse fails, the artifact is still written (with
// `status: failed` and a Raw output section) and the CLI
// exits 1. There is no retry.

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
  // The recovered artifact's relationships are rendered as
  // Markdown, not as raw JSON. To get the structured
  // relationships back we read the Raw output (debug) section
  // — but a recovered artifact does NOT include the raw
  // stdout (it is only emitted on failure). Instead we read
  // the Recovery Note + Markdown body and re-parse from a
  // dedicated block.
  //
  // The recovery path writes a structured relationships
  // section between `## Discovered Relationships (N)` and
  // `## Not Surfaced`. We do not have that as JSON, so the
  // CLI re-reads the raw stdout from the SOURCE failed
  // artifact that the recovered artifact was built from.
  const sourceIdx = body.indexOf('source: ');
  if (sourceIdx < 0) {
    throw new Error(
      `intent-boundary-cli: recovered artifact ${artifactPath} has no "source:" line in metadata; cannot locate raw stdout`,
    );
  }
  const lineStart = body.lastIndexOf('\n', sourceIdx) + 1;
  const lineEnd = body.indexOf('\n', sourceIdx);
  const sourceLine = body
    .slice(lineStart, lineEnd < 0 ? body.length : lineEnd)
    .trim();
  // The recovered artifact renders the source as a list
  // bullet, e.g. "- source: <path>". Strip the leading "- "
  // and any leading "source: " before checking the path.
  const sourcePath = sourceLine
    .replace(/^-\s+/, '')
    .replace(/^source:\s*/, '')
    .trim();
  if (!existsSync(sourcePath)) {
    throw new Error(
      `intent-boundary-cli: source artifact ${sourcePath} no longer exists`,
    );
  }
  const sourceBody = readFileSync(sourcePath, 'utf-8');
  const stdoutStart = sourceBody.indexOf(RAW_OUTPUT_HEADING);
  if (stdoutStart < 0) {
    throw new Error(
      `intent-boundary-cli: source artifact ${sourcePath} has no "${RAW_OUTPUT_HEADING}" section`,
    );
  }
  const afterHeading = sourceBody.slice(stdoutStart + RAW_OUTPUT_HEADING.length);
  const fenceOpen = afterHeading.indexOf('```');
  if (fenceOpen < 0) {
    throw new Error(
      `intent-boundary-cli: source artifact ${sourcePath} raw output has no opening fence`,
    );
  }
  let contentStart = fenceOpen + 3;
  if (afterHeading[contentStart] === '\n') contentStart += 1;
  const rest = afterHeading.slice(contentStart);
  const fenceClose = rest.lastIndexOf('```');
  if (fenceClose < 0) {
    throw new Error(
      `intent-boundary-cli: source artifact ${sourcePath} raw output has no closing fence`,
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
        'intent-boundary-cli: no recovered Stage 1 artifact found under artifacts/recruiting-poc/. Run `npm run recruiting-poc-recover-cli -- <failed-artifact>` first.\n',
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
    `intent-boundary-cli: stage1Artifact=${stage1ArtifactPath}\n`,
  );

  const stage1 = readRelationshipsFromRecoveredArtifact(stage1ArtifactPath);
  process.stdout.write(
    `intent-boundary-cli: relationshipCount=${stage1.relationships.length}\n`,
  );

  const outcome = await runRecruitingPocIntentBoundary({
    discoveredRelationships: stage1.relationships,
  });

  process.stdout.write(
    `\nintent-boundary-cli: status=${outcome.status}\n`,
  );
  process.stdout.write(
    `intent-boundary-cli: hermesInvocations=${outcome.hermesInvocations}\n`,
  );
  process.stdout.write(
    `intent-boundary-cli: durationMs=${outcome.durationMs}\n`,
  );
  if (outcome.intentBoundary !== null) {
    process.stdout.write(
      `intent-boundary-cli: question="${outcome.intentBoundary.question}"\n`,
    );
    process.stdout.write(
      `intent-boundary-cli: affectedCandidateIds=${outcome.intentBoundary.affectedRelationships.map((r) => r.candidateId).join(',')}\n`,
    );
  }
  if (outcome.errorMessage !== null) {
    process.stdout.write(
      `intent-boundary-cli: errorMessage=${outcome.errorMessage}\n`,
    );
  }
  process.stdout.write(
    `intent-boundary-cli: artifact=${outcome.artifactPath}\n`,
  );
  if (outcome.status === 'failed') {
    process.exit(1);
  }
}

main().catch((err) => {
  process.stderr.write(
    `intent-boundary-cli: ${err instanceof Error ? err.message : String(err)}\n`,
  );
  process.exit(1);
});
