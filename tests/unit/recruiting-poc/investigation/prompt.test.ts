import { describe, expect, it } from 'vitest';
import { buildAcquisitionPlanPrompt } from '../../../../matching/recruiting-poc/investigation/prompt.js';
import { createInvestigationState } from '../../../../matching/recruiting-poc/investigation/state.js';

// Substitutes the `"..."` placeholders in the prompt's example
// JSON with representative values, so we can JSON.parse the result.
// We deliberately do NOT touch the discriminator field
// (currentUserIsAppropriateEvidenceHolder) or humanQuestion —
// those are the very fields the prompt must spell out explicitly.
function fillPlaceholders(template: string): string {
  return template
    .replaceAll('"requiredEvidence":"..."', '"requiredEvidence":"sample evidence description"')
    .replaceAll('"evidenceHolder":"..."', '"evidenceHolder":"sample evidence holder"')
    .replaceAll('"acquisitionRoute":"..."', '"acquisitionRoute":"sample acquisition route"')
    .replaceAll('"acquisitionAction":"..."', '"acquisitionAction":"sample acquisition action"')
    .replaceAll('"recipientJustification":"..."', '"recipientJustification":"sample recipient justification"');
}

const baseState = () => createInvestigationState(
  { personId: 'P099', employerId: 'Patch Employer-01', relationship: 'candidate relationship' },
  'ORIGINAL person and employer evidence',
);
const awaitingAcquisition = () => ({
  ...baseState(),
  stage: 'awaiting_acquisition' as const,
  transferMechanism: 'specific mechanism',
  decisiveUnknown: 'decisive gap',
});

describe('buildAcquisitionPlanPrompt output JSON examples', () => {
  it('contains no ambiguous <true|false> placeholder', () => {
    const prompt = buildAcquisitionPlanPrompt(awaitingAcquisition());
    // The previous prompt instruction was not valid JSON: it
    // embedded `<true|false>` and a string-or-null placeholder
    // for humanQuestion. Both must be gone now that the example
    // is split into two explicit shapes.
    expect(prompt).not.toContain('<true|false>');
    expect(prompt).not.toMatch(/<non-empty[^>]*>/);
  });

  it('emits two explicit valid-JSON example shapes, one per branch', () => {
    const prompt = buildAcquisitionPlanPrompt(awaitingAcquisition());
    const filled = fillPlaceholders(prompt);

    // Extract the two example JSON objects by branch label.
    // The prompt spells them out as:
    //   "If currentUserIsAppropriateEvidenceHolder is true:\n{...}\n\nIf currentUserIsAppropriateEvidenceHolder is false:\n{...}"
    const trueMatch = /If currentUserIsAppropriateEvidenceHolder is true:\s*(\{[^\n]+\})/.exec(filled);
    const falseMatch = /If currentUserIsAppropriateEvidenceHolder is false:\s*(\{[^\n]+\})/.exec(filled);
    expect(trueMatch).not.toBeNull();
    expect(falseMatch).not.toBeNull();
    const trueJson = trueMatch?.[1];
    const falseJson = falseMatch?.[1];
    expect(trueJson).toBeDefined();
    expect(falseJson).toBeDefined();

    // Both must parse as valid JSON.
    const trueParsed = JSON.parse(trueJson as string) as Record<string, unknown>;
    const falseParsed = JSON.parse(falseJson as string) as Record<string, unknown>;
    expect(trueParsed.currentUserIsAppropriateEvidenceHolder).toBe(true);
    expect(falseParsed.currentUserIsAppropriateEvidenceHolder).toBe(false);
  });

  it('true branch example has boolean true and a string humanQuestion', () => {
    const prompt = buildAcquisitionPlanPrompt(awaitingAcquisition());
    const filled = fillPlaceholders(prompt);
    const trueMatch = /If currentUserIsAppropriateEvidenceHolder is true:\s*(\{[^\n]+\})/.exec(filled);
    expect(trueMatch).not.toBeNull();
    const parsed = JSON.parse(trueMatch?.[1] as string) as Record<string, unknown>;
    expect(typeof parsed.currentUserIsAppropriateEvidenceHolder).toBe('boolean');
    expect(parsed.currentUserIsAppropriateEvidenceHolder).toBe(true);
    expect(typeof parsed.humanQuestion).toBe('string');
    expect((parsed.humanQuestion as string).length).toBeGreaterThan(0);
  });

  it('false branch example has boolean false and JSON null humanQuestion', () => {
    const prompt = buildAcquisitionPlanPrompt(awaitingAcquisition());
    const filled = fillPlaceholders(prompt);
    const falseMatch = /If currentUserIsAppropriateEvidenceHolder is false:\s*(\{[^\n]+\})/.exec(filled);
    expect(falseMatch).not.toBeNull();
    const parsed = JSON.parse(falseMatch?.[1] as string) as Record<string, unknown>;
    expect(typeof parsed.currentUserIsAppropriateEvidenceHolder).toBe('boolean');
    expect(parsed.currentUserIsAppropriateEvidenceHolder).toBe(false);
    // humanQuestion in the false branch must be the JSON null
    // literal, not the string "null" and not absent.
    expect(parsed.humanQuestion).toBeNull();
    // The raw text must contain `:null` (the JSON null literal),
    // not `"null"` (the string).
    expect(falseMatch?.[1]).toMatch(/"humanQuestion":null/);
    expect(falseMatch?.[1]).not.toMatch(/"humanQuestion":"null"/);
  });

  it('preserves the balanced semantic instruction (no bias toward either branch)', () => {
    const prompt = buildAcquisitionPlanPrompt(awaitingAcquisition());
    // The previous wording steered the model toward false with
    // "do not assume they are the evidence holder." That
    // direction-of-bias language is gone; the model is asked to
    // decide from evidence alone.
    expect(prompt).not.toContain('do not assume they are the evidence holder');
    expect(prompt).toContain('decide from the provided evidence alone');
  });
});
