import { describe, expect, it } from 'vitest';
import { parseEvidenceReconstruction, parseRelationshipReasoning } from '../../../../apps/recruiting-exhibit/parse.js';

describe('recruiting-exhibit parsers', () => {
  it('parses a valid evidence reconstruction output', () => {
    const stdout = `preamble line 1
preamble line 2
{"directly_supported":"the article describes a Kafka postmortem","implied_meaning":"a candidate who has shipped this pattern may have the bar we need","hypotheses_unknowns":"we don't know if the author owned the system or only contributed"}`;
    const parsed = parseEvidenceReconstruction(stdout);
    expect(parsed.directly_supported).toMatch(/Kafka postmortem/);
    expect(parsed.implied_meaning.length).toBeGreaterThan(0);
    expect(parsed.hypotheses_unknowns.length).toBeGreaterThan(0);
  });

  it('parses a valid relationship reasoning output (surface decision)', () => {
    const stdout = `{"surface_decision":"surface","why_relevant":"matches our need for evidence-grounded incident reasoning","evidence_used":"first-person postmortem with measurable outcomes","most_important_unknown":"did the author own the system end to end"}`;
    const parsed = parseRelationshipReasoning(stdout);
    expect(parsed.surface_decision).toBe('surface');
    expect(parsed.why_relevant.length).toBeGreaterThan(0);
    expect(parsed.evidence_used.length).toBeGreaterThan(0);
    expect(parsed.most_important_unknown.length).toBeGreaterThan(0);
  });

  it('parses a valid relationship reasoning output (do_not_surface decision)', () => {
    const stdout = `{"surface_decision":"do_not_surface","why_relevant":"the article is about a different stack","evidence_used":"a marketing post","most_important_unknown":"we cannot tell whether the author has shipped production code"}`;
    const parsed = parseRelationshipReasoning(stdout);
    expect(parsed.surface_decision).toBe('do_not_surface');
  });

  it('rejects a surface_decision outside the allowed enum', () => {
    const stdout = `{"surface_decision":"maybe","why_relevant":"x","evidence_used":"y","most_important_unknown":"z"}`;
    expect(() => parseRelationshipReasoning(stdout)).toThrow(/failed schema validation/);
  });

  it('rejects a reconstruction that drops a field', () => {
    const stdout = `{"directly_supported":"only this field"}`;
    expect(() => parseEvidenceReconstruction(stdout)).toThrow(/failed schema validation/);
  });
});
