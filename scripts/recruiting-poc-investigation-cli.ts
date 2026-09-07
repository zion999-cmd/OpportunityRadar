import { HermesSubprocessClient } from '../runtime/hermes/subprocess-client.js';
import { writeInvestigationArtifact } from '../matching/recruiting-poc/investigation/artifact.js';
import { loadCollision01P004PatchFixture } from '../matching/recruiting-poc/investigation/fixture.js';
import { RelationshipInvestigation, InvestigationModelOutputError } from '../matching/recruiting-poc/investigation/runtime.js';

async function main(): Promise<void> {
  const client = new HermesSubprocessClient();
  if (!client.isAvailable()) throw new Error('Hermes is not available');
  const runtime = new RelationshipInvestigation(loadCollision01P004PatchFixture(), client);
  try {
    const state = await runtime.identifyEvidenceGap();
    const path = writeInvestigationArtifact(state, runtime.preservedFailures);
    process.stdout.write(`state: ${state.stage}\nartifact: ${path}\n`);
  } catch (error) {
    writeInvestigationArtifact(runtime.currentState, runtime.preservedFailures);
    if (error instanceof InvestigationModelOutputError) throw error;
    throw error;
  }
}

main().catch((error) => {
  process.stderr.write(`${error instanceof Error ? error.message : String(error)}\n`);
  process.exit(1);
});
