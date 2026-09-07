import { createInterface } from 'node:readline/promises';
import { stdin, stdout } from 'node:process';
import { HermesSubprocessClient } from '../runtime/hermes/subprocess-client.js';
import { Session } from '../matching/recruiting-poc/session/runtime.js';
import {
  renderAskForUser,
  renderSurfaceForUser,
} from '../matching/recruiting-poc/session/user-render.js';
import { writeSessionArtifact } from '../matching/recruiting-poc/session/artifact.js';

// scripts/recruiting-poc-session-cli.ts —
// interactive Product Spine CLI.
//
// Usage:
//   npm run recruiting-poc-session
//
// Flow:
//   1. CLI prompts the user for a raw situation (single
//      natural-language line).
//   2. Session runs a runtime turn.
//   3. If the runtime returns `ask`, CLI prints the
//      question in natural language and reads the user's
//      natural-language answer. Loops until the runtime
//      returns `surface` or the 2-ask budget is exhausted
//      (forced surface on the 3rd turn).
//   4. When the runtime surfaces, CLI prints the
//      relationships in natural language (no scores,
//      ranks, tags, filters, or extracted skills).
//   5. The session artifact is written under
//      `artifacts/recruiting-poc/<ts>_recruiting-poc-session.md`.
//
// Stage 0 §11 says: do not do a live interactive run in
// this round. The CLI is built and unit-tested with a
// stub client, but this entry point is not invoked as
// part of the Product Spine acceptance pass.

async function main(): Promise<void> {
  const client = new HermesSubprocessClient();
  if (!client.isAvailable()) {
    process.stderr.write(
      'recruiting-poc-session-cli: hermes is not available on this machine.\n',
    );
    process.exit(2);
  }

  const rl = createInterface({ input: stdin, output: stdout });
  try {
    process.stdout.write(
      '把你的情况用一句话写下来（不要填表）：\n',
    );
    const rawSituation = (await rl.question('> ')).trim();
    if (rawSituation.length === 0) {
      process.stdout.write('（未输入，结束。）\n');
      return;
    }

    const session = new Session(rawSituation, client);
    let terminated = false;
    while (!terminated) {
      const result = await session.step();
      if (result.decision.action === 'ask') {
        process.stdout.write('\n');
        process.stdout.write(renderAskForUser(result.decision));
        process.stdout.write('\n\n');
        const answer = (await rl.question('> ')).trim();
        if (answer.length === 0) {
          process.stdout.write('（未回答，结束。）\n');
          break;
        }
        const next = await session.step(answer);
        if (next.shouldTerminate && next.decision.action === 'surface') {
          process.stdout.write('\n');
          process.stdout.write(renderSurfaceForUser(next.decision));
          process.stdout.write('\n');
          terminated = true;
        }
      } else if (result.decision.action === 'surface') {
        process.stdout.write('\n');
        process.stdout.write(renderSurfaceForUser(result.decision));
        process.stdout.write('\n');
        terminated = true;
      }
    }

    const timeline = session.timeline();
    const artifactPath = writeSessionArtifact(timeline);
    process.stdout.write(`\n（artifact: ${artifactPath}）\n`);
  } finally {
    rl.close();
  }
}

main().catch((err) => {
  process.stderr.write(
    `recruiting-poc-session-cli: ${err instanceof Error ? err.message : String(err)}\n`,
  );
  process.exit(1);
});
