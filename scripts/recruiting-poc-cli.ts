import { runRecruitingPocFullPoolDiscovery } from '../matching/recruiting-poc/run.js';

// scripts/recruiting-poc-cli — POC entry point for the
// Semantic Native Recruiting POC v0 — Full-Pool Relationship
// Discovery Baseline.
//
// Usage:
//   npm run recruiting-poc-cli
//
// One Hermes one-shot. The model sees the verbatim employer
// situation and all 20 verbatim candidate raw experiences in a
// single prompt. It decides which (if any) candidates to
// surface. No embedding, no vector recall, no ranking, no
// exhaustive "unlikely" classification.

async function main(): Promise<void> {
  const outcome = await runRecruitingPocFullPoolDiscovery();
  process.stdout.write(`\nrecruiting-poc: status=${outcome.status}\n`);
  process.stdout.write(`recruiting-poc: durationMs=${outcome.durationMs}\n`);
  process.stdout.write(`recruiting-poc: relationshipCount=${outcome.relationships.length}\n`);
  for (const r of outcome.relationships) {
    process.stdout.write(
      `recruiting-poc: surfaced candidateId=${r.candidateId} judgment=${r.judgment}\n`,
    );
  }
  if (outcome.summary !== null) {
    process.stdout.write(`recruiting-poc: summary="${outcome.summary}"\n`);
  }
  if (outcome.errorMessage !== null) {
    process.stdout.write(`recruiting-poc: errorMessage=${outcome.errorMessage}\n`);
  }
  process.stdout.write(`recruiting-poc: artifact=${outcome.artifactPath}\n`);
  if (outcome.status === 'failed') {
    process.exit(1);
  }
}

main().catch((err) => {
  process.stderr.write(
    `recruiting-poc-cli: ${err instanceof Error ? err.message : String(err)}\n`,
  );
  process.exit(1);
});
