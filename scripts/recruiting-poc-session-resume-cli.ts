import { HermesSubprocessClient } from '../runtime/hermes/subprocess-client.js';
import {
  Session,
  SessionParseError,
} from '../matching/recruiting-poc/session/runtime.js';
import {
  readSessionSnapshot,
  writeSessionSnapshot,
} from '../matching/recruiting-poc/session/snapshot-io.js';
import {
  renderAskForUser,
  renderSurfaceForUser,
} from '../matching/recruiting-poc/session/user-render.js';
import { writeSessionArtifact } from '../matching/recruiting-poc/session/artifact.js';

// scripts/recruiting-poc-session-resume-cli.ts —
// one-shot resume CLI for the Product Spine session.
//
// Usage:
//   npm run recruiting-poc-session-resume -- <snapshot-json-path>
//
// Behavior (per the resume-seam spec):
//   1. Load the snapshot file at argv[2].
//   2. Restore the Session from the snapshot.
//   3. Run exactly ONE `session.step()` — this is the
//      single allowed hermes invocation.
//   4. Branch on the decision:
//        ask     → print the question, write a new snapshot,
//                  STOP, wait for the next invocation.
//        surface → print the relationships, write the 10-section
//                  artifact, STOP.
//        parse-error → `Session.step()` records a failed turn
//                  on the session and throws `SessionParseError`.
//                  We write a snapshot that includes the
//                  failedTurns[] entry, then exit 1 so the
//                  caller can inspect the failure before retrying.
//
// This script does NOT loop. It does NOT read user input from
// stdin. It is designed to be invoked once per turn after a
// human review pause.

async function main(): Promise<void> {
  const snapshotPath = process.argv[2];
  if (snapshotPath === undefined || snapshotPath.length === 0) {
    process.stderr.write(
      'usage: recruiting-poc-session-resume <snapshot-json-path>\n',
    );
    process.exit(2);
  }

  const client = new HermesSubprocessClient();
  if (!client.isAvailable()) {
    process.stderr.write(
      'recruiting-poc-session-resume: hermes is not available on this machine.\n',
    );
    process.exit(2);
  }

  const snapshot = readSessionSnapshot(snapshotPath);
  const session = Session.restore(snapshot, client);

  const situationPreview =
    snapshot.state.rawSituation.length > 80
      ? `${snapshot.state.rawSituation.slice(0, 80)}…`
      : snapshot.state.rawSituation;

  process.stdout.write(
    `[resume] restored snapshot ${snapshotPath}\n` +
      `[resume] rawSituation (first 80 chars): ${situationPreview}\n` +
      `[resume] rawIntentEvidence.length: ${snapshot.state.rawIntentEvidence.length}\n` +
      `[resume] askCount: ${snapshot.state.askCount}\n` +
      `[resume] turns.length: ${snapshot.turns.length}\n` +
      `[resume] next hermes call will be turn ${snapshot.turns.length + 1}\n\n`,
  );

  // The single allowed hermes invocation. A parse failure
  // must not erase the model invocation: `Session.step()`
  // records the failed turn on the session and throws a
  // typed `SessionParseError`. We catch it here, write a
  // snapshot that includes the failed turn, and exit non-zero
  // so the caller can inspect the failure before retrying.
  let result: Awaited<ReturnType<typeof session.step>>;
  try {
    result = await session.step();
  } catch (err: unknown) {
    if (err instanceof SessionParseError) {
      process.stderr.write(
        `[resume] turn ${err.failedTurn.turnIndex} parse failed: ${err.failedTurn.error}\n`,
      );
      const timeline = session.timeline();
      const failedSnapshotPath = writeSessionSnapshot(timeline);
      process.stderr.write(
        `[resume] recorded failed turn in snapshot: ${failedSnapshotPath}\n` +
          '[resume] STOP. The hermes response could not be parsed; inspect the snapshot\'s failedTurns[].\n',
      );
      process.exit(1);
    }
    throw err;
  }

  process.stdout.write(
    `[resume] turn ${result.turn.turnIndex} complete: action=${result.decision.action}\n\n`,
  );

  if (result.decision.action === 'ask') {
    process.stdout.write(renderAskForUser(result.decision));
    process.stdout.write('\n\n');
    const newSnapshotPath = writeSessionSnapshot(session.timeline());
    process.stdout.write(
      `[resume] runtime asked a new question. Wrote new snapshot: ${newSnapshotPath}\n` +
        '[resume] STOP. Pass the new snapshot path back into this CLI for the next turn.\n',
    );
    return;
  }

  // surface
  process.stdout.write(renderSurfaceForUser(result.decision));
  process.stdout.write('\n\n');
  const timeline = session.timeline();
  const artifactPath = writeSessionArtifact(timeline);
  process.stdout.write(`[resume] surfaced. Wrote artifact: ${artifactPath}\n`);
}

main().catch((err: unknown) => {
  process.stderr.write(
    `recruiting-poc-session-resume: ${err instanceof Error ? err.message : String(err)}\n`,
  );
  process.exit(1);
});
