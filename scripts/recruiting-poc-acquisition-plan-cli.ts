import { resolve } from 'node:path';
import { HermesSubprocessClient } from '../runtime/hermes/subprocess-client.js';
import { writeInvestigationArtifact } from '../matching/recruiting-poc/investigation/artifact.js';
import { readAcquisitionResumeState } from '../matching/recruiting-poc/investigation/resume.js';
import { RelationshipInvestigation } from '../matching/recruiting-poc/investigation/runtime.js';

const PRESERVED_ARTIFACT = resolve(process.cwd(), 'artifacts', 'recruiting-poc', 'investigation', '2026-09-07T10-37-53-502Z_p004-patch-investigation.json');

async function main(): Promise<void> {
  const resumed = readAcquisitionResumeState(PRESERVED_ARTIFACT);
  const client = new HermesSubprocessClient();
  if (!client.isAvailable()) throw new Error('Hermes is not available');
  const runtime = new RelationshipInvestigation(resumed.state, client);
  try {
    const state = await runtime.planAcquisition();
    const path = writeInvestigationArtifact(state, [...resumed.failures, ...runtime.preservedFailures]);
    process.stdout.write(`${JSON.stringify(state.acquisitionPlan)}\nartifact: ${path}\n`);
  } catch (error) {
    writeInvestigationArtifact(runtime.currentState, [...resumed.failures, ...runtime.preservedFailures]);
    throw error;
  }
}

main().catch((error) => {
  process.stderr.write(`${error instanceof Error ? error.message : String(error)}\n`);
  process.exit(1);
});
