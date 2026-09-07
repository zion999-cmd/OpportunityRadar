import { runSemanticCompletion } from '../semantic-completion/run.js';

// scripts/semantic-completion-cli — POC entry point for the
// Kafka→RabbitMQ Semantic Completion experiment.
//
// Usage:
//   npm run semantic-completion-cli
//
// No flags. Runs three sequential Hermes one-shots against the
// upstream-fixed Raw A and Raw B in `semantic-completion/cases.ts`
// and writes one artifact to `artifacts/semantic-completion/`.
//
// Step order:
//   1. Completion A     (raw A → 3-category completion)
//   2. Completion B     (raw B → 3-category completion)
//   3. Relationship     (A raw + A completion + B raw + B completion
//                        → 2-category relationship reasoning)

async function main(): Promise<void> {
  const outcome = await runSemanticCompletion();
  process.stdout.write(`\nsemantic-completion: status=${outcome.status}\n`);
  process.stdout.write(`semantic-completion: totalDurationMs=${outcome.totalDurationMs}\n`);
  if (outcome.errorMessage !== null) {
    process.stdout.write(`semantic-completion: errorMessage=${outcome.errorMessage}\n`);
  }
  process.stdout.write(`semantic-completion: artifact=${outcome.artifactPath}\n`);
  if (outcome.status === 'failed') {
    process.exit(1);
  }
}

main().catch((err) => {
  process.stderr.write(
    `semantic-completion-cli: ${err instanceof Error ? err.message : String(err)}\n`,
  );
  process.exit(1);
});
