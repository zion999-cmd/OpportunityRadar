import { HermesSubprocessClient } from '../runtime/hermes/subprocess-client.js';
import { writeInvestigationArtifact } from '../matching/recruiting-poc/investigation/artifact.js';
import { loadPilot01P012PatchFixture } from '../matching/recruiting-poc/investigation/fixture.js';
import { RelationshipInvestigation, InvestigationModelOutputError } from '../matching/recruiting-poc/investigation/runtime.js';

async function main(): Promise<void> {
  const client = new HermesSubprocessClient();
  if (!client.isAvailable()) throw new Error('Hermes is not available');
  const runtime = new RelationshipInvestigation(loadPilot01P012PatchFixture(), client);
  try {
    const afterGap = await runtime.identifyEvidenceGap();
    const state = await runtime.planAcquisition();
    const path = writeInvestigationArtifact(state, runtime.preservedFailures);
    process.stdout.write(`stage: ${state.stage}\ntransferMechanism: ${state.transferMechanism}\ndecisiveUnknown: ${state.decisiveUnknown}\nacquisitionPlan: ${JSON.stringify(state.acquisitionPlan, null, 2)}\nartifact: ${path}\n`);
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
