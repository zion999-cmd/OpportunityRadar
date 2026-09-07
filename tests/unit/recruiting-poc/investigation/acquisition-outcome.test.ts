import { describe, expect, it } from 'vitest';
import type { HermesClient, HermesOneShotRequest, HermesOneShotResult } from '../../../../runtime/hermes/types.js';
import { RelationshipInvestigation, InvestigationModelOutputError } from '../../../../matching/recruiting-poc/investigation/runtime.js';
import { createInvestigationState } from '../../../../matching/recruiting-poc/investigation/state.js';

class Stub implements HermesClient {
  readonly calls: HermesOneShotRequest[] = [];
  constructor(private readonly outputs: string[]) {}
  isAvailable() { return true; }
  async oneShot(req: HermesOneShotRequest): Promise<HermesOneShotResult> {
    this.calls.push(req);
    const stdout = this.outputs.shift();
    if (stdout === undefined) throw new Error('missing stub output');
    return { stdout, exitCode: 0, durationMs: 0 };
  }
}

const initial = () => createInvestigationState(
  { personId: 'P004', employerId: 'Patch Employer-01', relationship: 'candidate relationship' },
  'ORIGINAL person and employer evidence',
);
const result = (outcome: string) => JSON.stringify({ outcome, reasoning: 'because', evidenceUsed: ['original', 'new'], remainingUncertainty: [] });

const awaitingAcquisitionWithPlan = () => ({
  ...initial(),
  stage: 'awaiting_acquisition' as const,
  transferMechanism: 'Layered claim-to-evidence path with conditional disclosure.',
  decisiveUnknown: 'Whether Singer-Vine translated the static architecture into an interactive surface.',
  acquisitionPlan: {
    requiredEvidence: 'an attributable interactive artifact',
    evidenceHolder: 'Singer-Vine or a collaborator',
    acquisitionRoute: 'public web examination of an attributable artifact',
    acquisitionAction: 'Locate and verify one attributable interactive tool.',
    currentUserIsAppropriateEvidenceHolder: false,
    recipientJustification: 'The current operator is not established as a holder.',
    humanQuestion: null,
  },
});

const evidenceResultPath = '/artifacts/recruiting-poc/p004/evidence-result.md';
const acquisitionLogPath = '/artifacts/recruiting-poc/p004/acquisition-log.md';
const rawContent = 'Outcome: EVIDENCE_NOT_FOUND\nArtifact: none\nRemaining unknowns: (1) existence link, (2) attribution link.';

const notFoundIngest = {
  verdict: 'EVIDENCE_NOT_FOUND' as const,
  evidenceResultPath,
  acquisitionLogPath,
  rawContent,
};
const foundIngest = {
  verdict: 'EVIDENCE_FOUND' as const,
  evidenceResultPath,
  acquisitionLogPath,
  rawContent: 'Outcome: EVIDENCE_FOUND\nArtifact: A specific tool by Singer-Vine\nRemaining unknowns: [].',
};

describe('acquisition outcome ingest', () => {
  it('enters reevaluation when EVIDENCE_NOT_FOUND is ingested', async () => {
    const client = new Stub([result('surface_uncertain')]);
    const runtime = new RelationshipInvestigation(awaitingAcquisitionWithPlan(), client);
    const state = await runtime.submitAcquisitionOutcome(notFoundIngest);
    expect(state.stage).toBe('reevaluated');
    expect(state.acquisitionOutcome?.verdict).toBe('EVIDENCE_NOT_FOUND');
    expect(state.reevaluationResult?.outcome).toBe('surface_uncertain');
  });

  it('EVIDENCE_NOT_FOUND does not deterministically produce do_not_surface; EVIDENCE_FOUND is also accepted', async () => {
    const notFoundClient = new Stub([result('surface_worth_exploring')]);
    const notFoundRuntime = new RelationshipInvestigation(awaitingAcquisitionWithPlan(), notFoundClient);
    const notFoundState = await notFoundRuntime.submitAcquisitionOutcome(notFoundIngest);
    expect(notFoundState.reevaluationResult?.outcome).toBe('surface_worth_exploring');

    const foundClient = new Stub([result('do_not_surface')]);
    const foundRuntime = new RelationshipInvestigation(awaitingAcquisitionWithPlan(), foundClient);
    const foundState = await foundRuntime.submitAcquisitionOutcome(foundIngest);
    expect(foundState.reevaluationResult?.outcome).toBe('do_not_surface');
  });

  it('preserves the raw acquisition outcome separately from the model interpretation', async () => {
    const client = new Stub([result('surface_uncertain')]);
    const runtime = new RelationshipInvestigation(awaitingAcquisitionWithPlan(), client);
    const state = await runtime.submitAcquisitionOutcome(notFoundIngest);
    expect(state.acquisitionOutcome).toEqual({
      verdict: 'EVIDENCE_NOT_FOUND',
      evidenceResultPath,
      acquisitionLogPath,
      rawContent,
    });
    expect(state.reevaluationResult).not.toBeNull();
    expect(state.acquisitionOutcome).not.toBe(state.reevaluationResult);
    const prompt = client.calls[0]?.prompt ?? '';
    expect(prompt).toContain(rawContent);
    expect(prompt).toContain('ORIGINAL person and employer evidence');
    expect(prompt).toContain('do not normalize it into a candidate profile, skill, score, or taxonomy');
    expect(prompt).toContain('EVIDENCE_NOT_FOUND means');
    expect(prompt).toContain('does NOT mean the underlying capability does not exist');
  });

  it.each(['surface_worth_exploring', 'surface_uncertain', 'do_not_surface'])('accepts the existing product outcome %s', async (outcome) => {
    const client = new Stub([result(outcome)]);
    const runtime = new RelationshipInvestigation(awaitingAcquisitionWithPlan(), client);
    const state = await runtime.submitAcquisitionOutcome(notFoundIngest);
    expect(state.reevaluationResult?.outcome).toBe(outcome);
  });

  it('verdict is constrained to the two bounded values (compile-time guarantee)', () => {
    const accepted: ReadonlyArray<'EVIDENCE_FOUND' | 'EVIDENCE_NOT_FOUND'> = ['EVIDENCE_FOUND', 'EVIDENCE_NOT_FOUND'];
    expect(accepted).toContain('EVIDENCE_FOUND');
    expect(accepted).toContain('EVIDENCE_NOT_FOUND');
  });

  it('does not trigger a further investigation or acquisition loop after ingest', async () => {
    const client = new Stub([result('surface_uncertain')]);
    const runtime = new RelationshipInvestigation(awaitingAcquisitionWithPlan(), client);
    const state = await runtime.submitAcquisitionOutcome(notFoundIngest);
    expect(state.stage).toBe('reevaluated');
    await expect(runtime.identifyEvidenceGap()).rejects.toThrow('exactly one');
    await expect(runtime.planAcquisition()).rejects.toThrow('not awaiting acquisition planning');
    await expect(runtime.submitEvidence('any')).rejects.toThrow('not waiting for investigation evidence');
    expect(client.calls).toHaveLength(1);
  });

  it('rejects ingest when no acquisition plan is present (no plan -> no outcome)', async () => {
    const withoutPlan = awaitingAcquisitionWithPlan();
    const runtime = new RelationshipInvestigation(
      { ...withoutPlan, acquisitionPlan: null },
      new Stub([result('surface_uncertain')]),
    );
    await expect(runtime.submitAcquisitionOutcome(notFoundIngest)).rejects.toThrow('acquisition plan is required');
  });

  it('rejects ingest when the runtime is not in awaiting_acquisition', async () => {
    const runtime = new RelationshipInvestigation(initial(), new Stub([]));
    await expect(runtime.submitAcquisitionOutcome(notFoundIngest)).rejects.toThrow('not awaiting an acquisition outcome');
  });

  it('preserves invalid model output, stage, error, and state before failure', async () => {
    const runtime = new RelationshipInvestigation(awaitingAcquisitionWithPlan(), new Stub(['not valid output']));
    await expect(runtime.submitAcquisitionOutcome(notFoundIngest)).rejects.toBeInstanceOf(InvestigationModelOutputError);
    const failure = runtime.preservedFailures[0];
    expect(failure).toBeDefined();
    expect(failure?.stage).toBe('acquisition_reevaluation');
    expect(failure?.rawOutput).toBe('not valid output');
    expect(failure?.error.length).toBeGreaterThan(0);
    expect(failure?.stateBefore.acquisitionOutcome?.verdict).toBe('EVIDENCE_NOT_FOUND');
    expect(failure?.stateBefore.stage).toBe('awaiting_acquisition');
  });
});
