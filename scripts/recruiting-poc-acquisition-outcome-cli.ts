import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { HermesSubprocessClient } from '../runtime/hermes/subprocess-client.js';
import { writeInvestigationArtifact } from '../matching/recruiting-poc/investigation/artifact.js';
import { RelationshipInvestigation } from '../matching/recruiting-poc/investigation/runtime.js';

// Path to the investigation artifact that already contains the
// frozen P004 × Patch state after `planAcquisition`.
const PRESERVED_ARTIFACT = resolve(process.cwd(), 'artifacts', 'recruiting-poc', 'investigation', '2026-09-07T11-14-22-104Z_p004-patch-investigation.json');

// Paths to the bounded acquisition artifacts produced by the
// preceding P004 acquisition pass.
const EVIDENCE_RESULT_PATH = resolve(
  process.cwd(),
  'research', 'semantic-native', 'real-evidence', 'p004-acquisition-01', 'evidence-result.md',
);
const ACQUISITION_LOG_PATH = resolve(
  process.cwd(),
  'research', 'semantic-native', 'real-evidence', 'p004-acquisition-01', 'acquisition-log.md',
);

interface ArtifactEnvelope {
  readonly state: {
    readonly stage: string;
    readonly transferMechanism: string | null;
    readonly decisiveUnknown: string | null;
    readonly acquisitionPlan: unknown;
    readonly investigationEvidence: unknown;
  };
  readonly failures?: ReadonlyArray<unknown>;
}

function loadAcquisitionOutcomeState(path: string) {
  const envelope = JSON.parse(readFileSync(path, 'utf8')) as ArtifactEnvelope;
  if (envelope.state.stage !== 'awaiting_acquisition') {
    throw new Error(`unexpected stage in preserved artifact: ${envelope.state.stage}`);
  }
  if (envelope.state.acquisitionPlan === null || envelope.state.acquisitionPlan === undefined) {
    throw new Error('preserved artifact has no acquisition plan');
  }
  if (envelope.state.transferMechanism === null || envelope.state.decisiveUnknown === null) {
    throw new Error('preserved artifact is missing transferMechanism or decisiveUnknown');
  }
  return envelope;
}

async function main(): Promise<void> {
  const envelope = loadAcquisitionOutcomeState(PRESERVED_ARTIFACT);
  const rawContent = readFileSync(EVIDENCE_RESULT_PATH, 'utf8');
  const client = new HermesSubprocessClient();
  if (!client.isAvailable()) throw new Error('Hermes is not available');

  // Rebuild the runtime with the preserved investigation state.
  // (The preserved state is JSON, so we feed it through the fixture
  // loader's shape: it already matches the Collision-01 fixture's
  // relationshipCandidate and originalEvidence, with transferMechanism,
  // decisiveUnknown, and acquisitionPlan added by the prior stage.)
  const fixture = await import('../matching/recruiting-poc/investigation/fixture.js');
  const resumed = fixture.loadCollision01P004PatchFixture();
  const merged = {
    ...resumed,
    stage: 'awaiting_acquisition' as const,
    transferMechanism: envelope.state.transferMechanism,
    decisiveUnknown: envelope.state.decisiveUnknown,
    acquisitionPlan: envelope.state.acquisitionPlan as never,
    investigationEvidence: null,
    acquisitionOutcome: null,
    reevaluationResult: null,
  };
  const runtime = new RelationshipInvestigation(merged, client);
  try {
    const state = await runtime.submitAcquisitionOutcome({
      verdict: 'EVIDENCE_NOT_FOUND',
      evidenceResultPath: EVIDENCE_RESULT_PATH,
      acquisitionLogPath: ACQUISITION_LOG_PATH,
      rawContent,
    });
    const path = writeInvestigationArtifact(state, runtime.preservedFailures);
    process.stdout.write(`${JSON.stringify(state.reevaluationResult, null, 2)}\nartifact: ${path}\n`);
  } catch (error) {
    writeInvestigationArtifact(runtime.currentState, runtime.preservedFailures);
    throw error;
  }
}

main().catch((error) => {
  process.stderr.write(`${error instanceof Error ? error.message : String(error)}\n`);
  process.exit(1);
});
