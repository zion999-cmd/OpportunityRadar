import { runDiscovery } from '../matching/discovery/run.js';

// scripts/discovery-cli — POC entry point for the relationship
// discovery experiment.
//
// Usage:
//   npm run discovery-cli
//
// No flags. Runs a single Hermes one-shot against the two
// pre-baked pools in `matching/discovery/pools.ts` and writes
// one artifact to `artifacts/discovery/`. The model decides
// which (if any) recruiting/applying pairs to propose; this
// script does not pre-design or rank matches.

async function main(): Promise<void> {
  const outcome = await runDiscovery();
  process.stdout.write(`\ndiscovery: status=${outcome.status}\n`);
  process.stdout.write(`discovery: durationMs=${outcome.durationMs}\n`);
  process.stdout.write(`discovery: relationshipCount=${outcome.relationships.length}\n`);
  if (outcome.summary !== null) {
    process.stdout.write(`discovery: summary="${outcome.summary}"\n`);
  }
  if (outcome.errorMessage !== null) {
    process.stdout.write(`discovery: errorMessage=${outcome.errorMessage}\n`);
  }
  process.stdout.write(`discovery: artifact=${outcome.artifactPath}\n`);
  if (outcome.status === 'failed') {
    process.exit(1);
  }
}

main().catch((err) => {
  process.stderr.write(`discovery-cli: ${err instanceof Error ? err.message : String(err)}\n`);
  process.exit(1);
});
