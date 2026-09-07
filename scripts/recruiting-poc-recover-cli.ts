import { recoverStage1Run } from '../matching/recruiting-poc/recover.js';

// scripts/recruiting-poc-recover-cli.ts — CLI wrapper around
// recoverStage1Run. Usage:
//
//   npm run recruiting-poc-recover-cli -- <failed-artifact-path>
//
// Prints the recovery outcome to stdout and exits with code 0
// on success, code 1 on failure. Does not call Hermes.

const args = process.argv.slice(2);
const failedArtifactPath = args[0];
if (failedArtifactPath === undefined || failedArtifactPath.length === 0) {
  console.error('usage: recruiting-poc-recover-cli <failed-artifact-path>');
  process.exit(2);
}

const outcome = recoverStage1Run(failedArtifactPath);
console.log(JSON.stringify({
  status: outcome.status,
  errorMessage: outcome.errorMessage,
  recoveredArtifactPath: outcome.recoveredArtifactPath,
  sourceArtifactPath: outcome.sourceArtifactPath,
  durationMs: outcome.durationMs,
  relationshipCount: outcome.parsed?.relationships.length ?? 0,
  surfacedCandidateIds: outcome.parsed?.relationships.map((r) => r.candidateId) ?? [],
  judgmentCounts: outcome.parsed === null ? null : {
    worth_exploring: outcome.parsed.relationships.filter((r) => r.judgment === 'worth_exploring').length,
    uncertain: outcome.parsed.relationships.filter((r) => r.judgment === 'uncertain').length,
  },
}, null, 2));

if (outcome.status === 'failed') {
  process.exit(1);
}
