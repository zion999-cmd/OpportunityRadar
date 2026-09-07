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
const question = JSON.stringify({ transferMechanism: 'specific mechanism', decisiveUnknown: 'decisive gap' });
const result = (outcome: string) => JSON.stringify({ outcome, reasoning: 'because', evidenceUsed: ['original', 'new'], remainingUncertainty: [] });
const awaitingAcquisition = () => ({
  ...initial(),
  stage: 'awaiting_acquisition' as const,
  transferMechanism: 'specific mechanism',
  decisiveUnknown: 'decisive gap',
});
const plan = (overrides: Record<string, unknown> = {}) => JSON.stringify({
  requiredEvidence: 'an attributable account or inspectable artifact showing the decision and use',
  evidenceHolder: 'the person who made the design decision or a contemporaneous artifact',
  acquisitionRoute: 'request the artifact from its legitimate custodian and review it',
  acquisitionAction: 'Obtain one attributable artifact and preserve it as raw evidence.',
  currentUserIsAppropriateEvidenceHolder: false,
  recipientJustification: 'Nothing establishes that the current operator participated in the work.',
  humanQuestion: null,
  ...overrides,
});

describe('relationship-specific investigation runtime', () => {
  it('enters acquisition routing without producing a question', async () => {
    const runtime = new RelationshipInvestigation(initial(), new Stub([question]));
    const state = await runtime.identifyEvidenceGap();
    expect(state.stage).toBe('awaiting_acquisition');
    expect(state.investigationEvidence).toBeNull();
    await expect(runtime.identifyEvidenceGap()).rejects.toThrow('exactly one');
  });

  it('preserves the raw answer verbatim without profile-like fields and sends original plus new evidence', async () => {
    const raw = '  I made that call.\nWe withheld names, exactly as written.  ';
    const client = new Stub([result('surface_worth_exploring')]);
    const ready = { ...awaitingAcquisition(), stage: 'awaiting_investigation_evidence' as const, investigationEvidence: { question: 'Legitimately routed question', rawAnswer: '' } };
    const runtime = new RelationshipInvestigation(ready, client);
    const state = await runtime.submitEvidence(raw);
    expect(state.investigationEvidence?.rawAnswer).toBe(raw);
    expect(Object.keys(state)).not.toEqual(expect.arrayContaining(['skills', 'tags', 'profile', 'requirements']));
    expect(client.calls[0]?.prompt).toContain('ORIGINAL person and employer evidence');
    expect(client.calls[0]?.prompt).toContain(raw);
  });

  it.each(['surface_worth_exploring', 'surface_uncertain', 'do_not_surface'])('accepts final transition %s', async (outcome) => {
    const ready = { ...awaitingAcquisition(), stage: 'awaiting_investigation_evidence' as const, investigationEvidence: { question: 'Legitimately routed question', rawAnswer: '' } };
    const runtime = new RelationshipInvestigation(ready, new Stub([result(outcome)]));
    expect((await runtime.submitEvidence('raw answer')).reevaluationResult?.outcome).toBe(outcome);
  });

  it('preserves invalid model output, stage, error, and state before failure', async () => {
    const runtime = new RelationshipInvestigation(initial(), new Stub(['not valid output']));
    await expect(runtime.identifyEvidenceGap()).rejects.toBeInstanceOf(InvestigationModelOutputError);
    expect(runtime.preservedFailures[0]).toMatchObject({ stage: 'transfer_mechanism_check', rawOutput: 'not valid output', stateBefore: initial() });
    expect(runtime.preservedFailures[0]?.error.length).toBeGreaterThan(0);
  });

  it('does not permit a second question after evidence is submitted', async () => {
    const ready = { ...awaitingAcquisition(), stage: 'awaiting_investigation_evidence' as const, investigationEvidence: { question: 'Legitimately routed question', rawAnswer: '' } };
    const runtime = new RelationshipInvestigation(ready, new Stub([result('surface_uncertain')]));
    await runtime.submitEvidence('answer');
    await expect(runtime.identifyEvidenceGap()).rejects.toThrow('exactly one');
  });
});

describe('evidence acquisition routing', () => {
  it('derives and preserves an acquisition plan without inventing evidence or reevaluating', async () => {
    const client = new Stub([plan()]);
    const runtime = new RelationshipInvestigation(awaitingAcquisition(), client);
    const state = await runtime.planAcquisition();
    expect(state.stage).toBe('awaiting_acquisition');
    expect(state.acquisitionPlan).toMatchObject({
      requiredEvidence: expect.any(String),
      evidenceHolder: expect.any(String),
      acquisitionRoute: expect.any(String),
      acquisitionAction: expect.any(String),
      currentUserIsAppropriateEvidenceHolder: false,
      humanQuestion: null,
    });
    expect(state.investigationEvidence).toBeNull();
    expect(state.reevaluationResult).toBeNull();
    expect(client.calls).toHaveLength(1);
  });

  it('does not automatically treat the current user as holder or emit a human question', async () => {
    const runtime = new RelationshipInvestigation(awaitingAcquisition(), new Stub([plan()]));
    const state = await runtime.planAcquisition();
    expect(state.acquisitionPlan?.currentUserIsAppropriateEvidenceHolder).toBe(false);
    expect(state.acquisitionPlan?.humanQuestion).toBeNull();
  });

  it('rejects a human question when the current user is not semantically justified', async () => {
    const invalid = plan({ humanQuestion: 'Can you answer this?' });
    const runtime = new RelationshipInvestigation(awaitingAcquisition(), new Stub([invalid]));
    await expect(runtime.planAcquisition()).rejects.toBeInstanceOf(InvestigationModelOutputError);
    expect(runtime.preservedFailures[0]).toMatchObject({ stage: 'acquisition_planning', rawOutput: invalid });
  });

  it('accepts a human question only with explicit holder status and recipient justification', async () => {
    const justified = plan({
      currentUserIsAppropriateEvidenceHolder: true,
      recipientJustification: 'The supplied evidence identifies the current user as the decision owner.',
      humanQuestion: 'What decision did you make?',
    });
    const state = await new RelationshipInvestigation(awaitingAcquisition(), new Stub([justified])).planAcquisition();
    expect(state.acquisitionPlan?.humanQuestion).toBe('What decision did you make?');
  });

  it('preserves invalid acquisition model output with pre-failure state', async () => {
    const runtime = new RelationshipInvestigation(awaitingAcquisition(), new Stub(['invalid']));
    await expect(runtime.planAcquisition()).rejects.toBeInstanceOf(InvestigationModelOutputError);
    expect(runtime.preservedFailures[0]).toMatchObject({
      stage: 'acquisition_planning',
      rawOutput: 'invalid',
      stateBefore: awaitingAcquisition(),
    });
  });
});
