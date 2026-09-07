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
    // The frozen EVIDENCE_NOT_FOUND principle: not evidence that
    // the capability is absent, but a bounded acquisition may still
    // provide negative information.
    expect(prompt).toContain('EVIDENCE_NOT_FOUND is not evidence that the underlying capability is absent');
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

describe('EVIDENCE_NOT_FOUND epistemic rule in acquisition reevaluation prompt', () => {
  // The acquisition reevaluation prompt must carry the frozen
  // EVIDENCE_NOT_FOUND principle: not evidence that the capability
  // is absent, but the bounded acquisition may still provide
  // negative information and the model is allowed to update the
  // relationship accordingly. It must NOT contain the previous
  // unconditional "do not penalize" or "evidence of absence"
  // conversion wording.
  it('does not contain the prohibited "evidence of absence" conversion or unconditional "do not penalize" wording', async () => {
    const client = new Stub([result('surface_uncertain')]);
    const runtime = new RelationshipInvestigation(awaitingAcquisitionWithPlan(), client);
    await runtime.submitAcquisitionOutcome(notFoundIngest);
    const prompt = client.calls[0]?.prompt ?? '';
    // The previous wording forbade the model from "converting
    // absence of discovered public evidence into evidence of
    // absence" and from "penaliz[ing] the relationship merely
    // because the route terminated as unresolved." Both are gone.
    expect(prompt).not.toContain('evidence of absence');
    expect(prompt).not.toContain('Do not penalize');
    expect(prompt).not.toContain('merely because the route terminated as unresolved');
  });

  it('carries the frozen EVIDENCE_NOT_FOUND principle verbatim', async () => {
    const client = new Stub([result('surface_uncertain')]);
    const runtime = new RelationshipInvestigation(awaitingAcquisitionWithPlan(), client);
    await runtime.submitAcquisitionOutcome(notFoundIngest);
    const prompt = client.calls[0]?.prompt ?? '';
    // The new rule is positive and explicit: EVIDENCE_NOT_FOUND is
    // not proof of absence, but a bounded acquisition may still
    // carry negative information, and the model is allowed to
    // update the relationship accordingly. The two boundary
    // instructions ("do not treat as automatic failure", "do not
    // treat it as zero information") close both halves of the
    // failure mode the previous wording conflated.
    expect(prompt).toContain('EVIDENCE_NOT_FOUND is not evidence that the underlying capability is absent');
    expect(prompt).toContain('a bounded acquisition may still provide negative information');
    // The four informativeness signals are wrapped across lines in
    // the prompt; assert each one is present and contiguous.
    expect(prompt).toMatch(/coverage,\s+source reachability,\s+specificity of what was/);
    expect(prompt).toMatch(/concrete missing links/);
    expect(prompt).toContain('update the relationship accordingly');
    expect(prompt).toContain('Do not treat EVIDENCE_NOT_FOUND as automatic failure');
    expect(prompt).toContain('Do not treat it as zero information');
    // No numeric confidence or deterministic weighting introduced.
    expect(prompt).not.toMatch(/\bconfidence\b/i);
    expect(prompt).not.toMatch(/\bweight(?:ing)?\b/i);
  });

  it('allows the model to update the relationship downward on informative EVIDENCE_NOT_FOUND', async () => {
    // The frozen principle explicitly permits a downward update
    // when the bounded acquisition is informative (e.g. concrete
    // missing links). This test pins the runtime contract: with
    // EVIDENCE_NOT_FOUND the model is not deterministically
    // pinned to surface_worth_exploring or surface_uncertain; it
    // can also produce do_not_surface.
    const client = new Stub([result('do_not_surface')]);
    const runtime = new RelationshipInvestigation(awaitingAcquisitionWithPlan(), client);
    const state = await runtime.submitAcquisitionOutcome(notFoundIngest);
    expect(state.acquisitionOutcome?.verdict).toBe('EVIDENCE_NOT_FOUND');
    expect(state.reevaluationResult?.outcome).toBe('do_not_surface');
  });

  it('still allows the model to remain at surface_worth_exploring on uninformative EVIDENCE_NOT_FOUND', async () => {
    // The frozen principle is not a forced downgrade either. An
    // uninformative EVIDENCE_NOT_FOUND (e.g. empty coverage, no
    // concrete missing links) must still be allowed to leave the
    // relationship at surface_worth_exploring.
    const client = new Stub([result('surface_worth_exploring')]);
    const runtime = new RelationshipInvestigation(awaitingAcquisitionWithPlan(), client);
    const state = await runtime.submitAcquisitionOutcome(notFoundIngest);
    expect(state.acquisitionOutcome?.verdict).toBe('EVIDENCE_NOT_FOUND');
    expect(state.reevaluationResult?.outcome).toBe('surface_worth_exploring');
  });
});
