import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { parseFullPoolDiscoveryOutput, type FullPoolDiscoveryOutput } from './parse.js';
import { writeFullPoolDiscoveryArtifact } from './artifact.js';

// matching/recruiting-poc/recover.ts — re-parse the raw output
// that a prior run saved into its `## Raw output (debug)`
// section, using the (possibly fixed) parser. No new LLM call.
// The recovery is a one-way path: if the parse still fails, the
// recovered artifact is written with `status: failed` and the
// error message; we do not loop, retry, or re-invoke Hermes.

export const RAW_OUTPUT_HEADING = '## Raw output (debug)';

export interface RecoveredRunOutcome {
  readonly status: 'succeeded' | 'failed';
  readonly parsed: FullPoolDiscoveryOutput | null;
  readonly errorMessage: string | null;
  readonly recoveredArtifactPath: string;
  readonly sourceArtifactPath: string;
  readonly durationMs: number;
}

/**
 * Read a failed Stage 1 artifact and extract the raw Hermes
 * stdout that the prior run captured into its
 * `## Raw output (debug)` section.
 *
 * The raw stdout is the verbatim text between the section
 * heading's opening and closing ``` fences. We strip exactly
 * the leading newline that `renderFullPoolDiscoveryArtifact`
 * inserts between the opening fence and the stdout, and
 * exactly the trailing newline that precedes the closing
 * fence — no other edits. The (fixed) parser handles any
 * trailing junk the model may have emitted after the JSON.
 */
export function readFailedArtifactRawStdout(artifactPath: string): string {
  const body = readFileSync(artifactPath, 'utf-8');
  const debugIdx = body.indexOf(RAW_OUTPUT_HEADING);
  if (debugIdx < 0) {
    throw new Error(
      `recover: artifact ${artifactPath} has no "${RAW_OUTPUT_HEADING}" section`,
    );
  }
  const afterHeading = body.slice(debugIdx + RAW_OUTPUT_HEADING.length);
  const fenceOpen = afterHeading.indexOf('```');
  if (fenceOpen < 0) {
    throw new Error(
      `recover: artifact ${artifactPath} Raw output section has no opening code fence`,
    );
  }
  let contentStart = fenceOpen + 3;
  // Skip the single newline that the artifact renderer puts
  // between the opening fence and the stdout. Anything more
  // than that one newline is part of the captured stdout.
  if (afterHeading[contentStart] === '\n') {
    contentStart += 1;
  }
  const rest = afterHeading.slice(contentStart);
  const fenceClose = rest.lastIndexOf('```');
  if (fenceClose < 0) {
    throw new Error(
      `recover: artifact ${artifactPath} Raw output section has no closing code fence`,
    );
  }
  // Strip the single trailing newline that precedes the
  // closing fence. Anything after that is unrelated content
  // and is preserved (the parser will reject it).
  let contentEnd = fenceClose;
  if (contentEnd > 0 && rest[contentEnd - 1] === '\n') {
    contentEnd -= 1;
  }
  return rest.slice(0, contentEnd);
}

const RECOVERY_NOTE_TEMPLATE = (
  sourceArtifactPath: string,
  recoveredAt: string,
): string =>
  [
    '**Source:** original Stage 1 oracle run. No new LLM invocation.',
    '',
    `This artifact was recovered by re-parsing the raw Hermes stdout saved into the \`## Raw output (debug)\` section of \`${sourceArtifactPath}\`. The parser in \`runtime/hermes/parse.ts\` was extended with a generic trailing-junk recovery strategy that finds the actual end of a balanced JSON object by forward-scanning for the first depth-zero position; the original raw output was emitted with one extra \`}\` after the closing brace of the JSON object, which both the prior single-line and balanced-search strategies returned as part of their candidate slice.`,
    '',
    `Recovered at: ${recoveredAt}.`,
  ].join('\n');

/**
 * Recover the structured result from a previously-failed
 * Stage 1 artifact. Re-parses the saved raw stdout with the
 * (now fixed) parser; if the parse still fails, writes a
 * failed-recovery artifact and returns `status: failed`.
 *
 * The recovered artifact is written under
 * `artifacts/recruiting-poc/` with a `.recovered` suffix in
 * the file name so it is not confused with a fresh run.
 */
export function recoverStage1Run(artifactPath: string): RecoveredRunOutcome {
  const started = Date.now();
  const absoluteSource = resolve(artifactPath);
  let status: 'succeeded' | 'failed' = 'succeeded';
  let parsed: FullPoolDiscoveryOutput | null = null;
  let errorMessage: string | null = null;
  let stdoutForArtifact = '';
  try {
    const stdout = readFailedArtifactRawStdout(absoluteSource);
    stdoutForArtifact = stdout;
    parsed = parseFullPoolDiscoveryOutput(stdout);
  } catch (err) {
    status = 'failed';
    errorMessage = err instanceof Error ? err.message : String(err);
  }
  const durationMs = Date.now() - started;
  const recoveryNote = RECOVERY_NOTE_TEMPLATE(
    absoluteSource,
    new Date().toISOString(),
  );
  const recoveredArtifactPath = writeFullPoolDiscoveryArtifact(
    {
      status,
      summary: parsed?.summary ?? null,
      relationships: parsed?.relationships ?? [],
      errorMessage,
      durationMs,
      stdout: stdoutForArtifact,
      recoveryNote: recoveryNote,
      recoverySourcePath: absoluteSource,
    },
    { fileSuffix: '.recovered' },
  );
  return {
    status,
    parsed,
    errorMessage,
    recoveredArtifactPath,
    sourceArtifactPath: absoluteSource,
    durationMs,
  };
}
