import { runAllCrossDomainCases } from '../semantic-completion/run.js';
import { CROSS_DOMAIN_CASES } from '../semantic-completion/cross-domain-cases.js';

// scripts/semantic-completion-cross-domain-cli — POC entry point
// for the 3 cross-domain cases in this experiment.
//
// Usage:
//   npm run semantic-completion-cross-domain-cli
//
// Iterates the 3 fixed upstream-defined cases in
// `semantic-completion/cross-domain-cases.ts`, runs 3 sequential
// Hermes one-shots per case (Completion A → Completion B →
// Relationship), and writes one artifact per case to
// `artifacts/semantic-completion/<ts>_<caseId>_semantic-completion.md`.
// Total: 9 one-shots.

async function main(): Promise<void> {
  const batch = await runAllCrossDomainCases(CROSS_DOMAIN_CASES);
  for (const outcome of batch.cases) {
    process.stdout.write(
      `cross-domain-semantic-completion: case=${outcome.caseId ?? '<legacy>'} status=${outcome.status} durationMs=${outcome.totalDurationMs} artifact=${outcome.artifactPath}\n`,
    );
    if (outcome.errorMessage !== null) {
      process.stdout.write(
        `cross-domain-semantic-completion: case=${outcome.caseId ?? '<legacy>'} errorMessage=${outcome.errorMessage}\n`,
      );
    }
  }
  process.stdout.write(
    `cross-domain-semantic-completion: totalCases=${batch.cases.length} totalDurationMs=${batch.totalDurationMs}\n`,
  );
  const anyFailed = batch.cases.some((c) => c.status === 'failed');
  if (anyFailed) {
    process.exit(1);
  }
}

main().catch((err) => {
  process.stderr.write(
    `semantic-completion-cross-domain-cli: ${err instanceof Error ? err.message : String(err)}\n`,
  );
  process.exit(1);
});
