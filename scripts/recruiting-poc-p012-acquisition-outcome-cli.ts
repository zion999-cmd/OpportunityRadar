import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { HermesSubprocessClient } from '../runtime/hermes/subprocess-client.js';
import { writeInvestigationArtifact } from '../matching/recruiting-poc/investigation/artifact.js';
import { loadPilot01P012PatchFixture } from '../matching/recruiting-poc/investigation/fixture.js';
import { RelationshipInvestigation } from '../matching/recruiting-poc/investigation/runtime.js';

// The P012 investigation artifact, written by the preceding
// `recruiting-poc-p012-acquisition-cli` pass. (The artifact writer
// uses a fixed filename prefix that does not encode personId; the
// file body is the P012 run, verified at load time.)
const PRESERVED_ARTIFACT = resolve(
  process.cwd(),
  'artifacts', 'recruiting-poc', 'investigation', '2026-09-07T11-59-34-815Z_p004-patch-investigation.json',
);

const EVIDENCE_RESULT_PATH = resolve(
  process.cwd(),
  'research', 'semantic-native', 'real-evidence', 'p012-acquisition-01', 'evidence-result.md',
);
const ACQUISITION_LOG_PATH = resolve(
  process.cwd(),
  'research', 'semantic-native', 'real-evidence', 'p012-acquisition-01', 'acquisition-log.md',
);

interface ArtifactEnvelope {
  readonly state: {
    readonly stage: string;
    readonly relationshipCandidate?: { readonly personId?: string };
    readonly transferMechanism: string | null;
    readonly decisiveUnknown: string | null;
    readonly acquisitionPlan: unknown;
    readonly investigationEvidence: unknown;
  };
  readonly failures?: ReadonlyArray<unknown>;
}

function loadP012AcquisitionOutcomeState(path: string) {
  const envelope = JSON.parse(readFileSync(path, 'utf8')) as ArtifactEnvelope;
  if (envelope.state.stage !== 'awaiting_acquisition') {
    throw new Error(`unexpected stage in preserved artifact: ${envelope.state.stage}`);
  }
  if (envelope.state.relationshipCandidate?.personId !== 'P012') {
    throw new Error(`preserved artifact is not a P012 run: personId=${envelope.state.relationshipCandidate?.personId}`);
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
  const envelope = loadP012AcquisitionOutcomeState(PRESERVED_ARTIFACT);
  const rawContent = readFileSync(EVIDENCE_RESULT_PATH, 'utf8');
  const client = new HermesSubprocessClient();
  if (!client.isAvailable()) throw new Error('Hermes is not available');

  // Rebuild the runtime with the preserved P012 investigation state.
  const fixture = loadPilot01P012PatchFixture();
  const merged = {
    ...fixture,
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
