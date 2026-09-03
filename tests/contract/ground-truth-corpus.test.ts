import { describe, it, expect } from 'vitest';
import { z } from 'zod';
import { SourceDocumentSchema } from '../../evidence/contracts/source-document.js';
import { EvidenceSchema, evidenceTypeSchema } from '../../evidence/contracts/evidence.js';
import { groundTruthSources, groundTruthEvidence } from '../../evidence/ground-truth/index.js';

// Contract test for the Ground Truth corpus.
//
// The corpus is a *closed contract*. It is the only "real-world"
// fixture set the product has at the end of P0001. This test
// enforces every P0001 §Ground Truth gate; future Proposals
// either keep them green or relax them by ADR (not by editing
// this file to make it pass).

const MIN_SOURCES = 15;
const MAX_SOURCES = 25;
const MIN_EVIDENCE = 30;
const MAX_EVIDENCE = 50;
const MIN_ATOMIC_SOURCES = 5;
const MIN_EVIDENCE_PER_ATOMIC_SOURCE = 3;
const MIN_CORROBORATED_EVIDENCE = 2;
const MIN_SOURCEREFS_PER_CORROBORATION = 2;

describe('Ground Truth corpus — schema validity', () => {
  it('every SourceDocument fixture parses against SourceDocumentSchema', () => {
    // Arrange / Act / Assert per fixture.
    for (const source of groundTruthSources) {
      const result = SourceDocumentSchema.safeParse(source);
      expect(result.success, `source ${source.id} failed: ${JSON.stringify(result)}`).toBe(true);
    }
  });

  it('every Evidence fixture parses against EvidenceSchema', () => {
    for (const evidence of groundTruthEvidence) {
      const result = EvidenceSchema.safeParse(evidence);
      expect(result.success, `evidence ${evidence.id} failed: ${JSON.stringify(result)}`).toBe(true);
    }
  });
});

describe('Ground Truth corpus — ID uniqueness', () => {
  it('source IDs are unique', () => {
    // Arrange
    const ids = groundTruthSources.map((s) => s.id);

    // Act
    const seen = new Set<string>();
    const duplicates: string[] = [];
    for (const id of ids) {
      if (seen.has(id)) duplicates.push(id);
      seen.add(id);
    }

    // Assert
    expect(duplicates).toEqual([]);
  });

  it('evidence IDs are unique', () => {
    const ids = groundTruthEvidence.map((e) => e.id);
    const seen = new Set<string>();
    const duplicates: string[] = [];
    for (const id of ids) {
      if (seen.has(id)) duplicates.push(id);
      seen.add(id);
    }
    expect(duplicates).toEqual([]);
  });
});

describe('Ground Truth corpus — size gates', () => {
  it(`source count is between ${MIN_SOURCES} and ${MAX_SOURCES}`, () => {
    expect(groundTruthSources.length).toBeGreaterThanOrEqual(MIN_SOURCES);
    expect(groundTruthSources.length).toBeLessThanOrEqual(MAX_SOURCES);
  });

  it(`evidence count is between ${MIN_EVIDENCE} and ${MAX_EVIDENCE}`, () => {
    expect(groundTruthEvidence.length).toBeGreaterThanOrEqual(MIN_EVIDENCE);
    expect(groundTruthEvidence.length).toBeLessThanOrEqual(MAX_EVIDENCE);
  });
});

describe('Ground Truth corpus — taxonomy coverage', () => {
  it('every evidenceType in the taxonomy has at least one fixture', () => {
    // Arrange
    const typesInCorpus = new Set(groundTruthEvidence.map((e) => e.evidenceType));
    const typesInTaxonomy = evidenceTypeSchema.options;

    // Act / Assert
    for (const t of typesInTaxonomy) {
      expect(typesInCorpus.has(t), `missing evidenceType in corpus: ${t}`).toBe(true);
    }
  });

  it('market values are within the source-market enum', () => {
    const marketValues = new Set(groundTruthSources.map((s) => s.market));
    const evidenceMarketValues = new Set(groundTruthEvidence.map((e) => e.market));
    const allMarkets = new Set([...marketValues, ...evidenceMarketValues]);
    for (const m of allMarkets) {
      expect(['CN', 'US', 'GLOBAL', 'OTHER']).toContain(m);
    }
  });
});

describe('Ground Truth corpus — reference integrity', () => {
  it('every sourceRef resolves to a known source', () => {
    // Arrange
    const sourceIds = new Set(groundTruthSources.map((s) => s.id));
    const dangling: Array<{ evidenceId: string; ref: string }> = [];

    // Act
    for (const evidence of groundTruthEvidence) {
      for (const ref of evidence.sourceRefs) {
        if (!sourceIds.has(ref)) dangling.push({ evidenceId: evidence.id, ref });
      }
    }

    // Assert
    expect(dangling).toEqual([]);
  });

  it('every evidence has at least one sourceRef', () => {
    for (const evidence of groundTruthEvidence) {
      expect(evidence.sourceRefs.length, evidence.id).toBeGreaterThan(0);
    }
  });
});

describe('Ground Truth corpus — atomicity gate', () => {
  it(`at least ${MIN_ATOMIC_SOURCES} sources support ≥ ${MIN_EVIDENCE_PER_ATOMIC_SOURCE} evidence each`, () => {
    // Arrange: count evidence per source
    const counts = new Map<string, number>();
    for (const source of groundTruthSources) counts.set(source.id, 0);
    for (const evidence of groundTruthEvidence) {
      for (const ref of evidence.sourceRefs) {
        counts.set(ref, (counts.get(ref) ?? 0) + 1);
      }
    }

    // Act: count sources above threshold
    const atomic = [...counts.values()].filter(
      (n) => n >= MIN_EVIDENCE_PER_ATOMIC_SOURCE,
    ).length;

    // Assert
    expect(atomic).toBeGreaterThanOrEqual(MIN_ATOMIC_SOURCES);
  });
});

describe('Ground Truth corpus — corroboration gate', () => {
  it(`at least ${MIN_CORROBORATED_EVIDENCE} evidence have ≥ ${MIN_SOURCEREFS_PER_CORROBORATION} sourceRefs`, () => {
    // Arrange / Act
    const corroborated = groundTruthEvidence.filter(
      (e) => e.sourceRefs.length >= MIN_SOURCEREFS_PER_CORROBORATION,
    ).length;

    // Assert
    expect(corroborated).toBeGreaterThanOrEqual(MIN_CORROBORATED_EVIDENCE);
  });
});

describe('Ground Truth corpus — temporal sanity', () => {
  it('every Evidence has a non-null observedAt and a parseable eventAt when present', () => {
    for (const evidence of groundTruthEvidence) {
      // observedAt is required
      expect(evidence.observedAt, evidence.id).toBeTruthy();
      const observed = new Date(evidence.observedAt);
      expect(Number.isNaN(observed.getTime()), evidence.id).toBe(false);

      // eventAt is optional but must be parseable when present
      if (evidence.eventAt !== null) {
        const event = new Date(evidence.eventAt);
        expect(Number.isNaN(event.getTime()), evidence.id).toBe(false);
      }
    }
  });

  it('every SourceDocument has a parseable accessedAt when present', () => {
    for (const source of groundTruthSources) {
      if (source.accessedAt !== null) {
        const accessed = new Date(source.accessedAt);
        expect(Number.isNaN(accessed.getTime()), source.id).toBe(false);
      }
    }
  });
});

describe('Ground Truth corpus — Zod smoke', () => {
  it('zod is a hard dependency, not just a type import', () => {
    // Sanity guard: if Zod is removed, this test will fail to compile.
    const schema = z.string();
    expect(schema.parse('hello')).toBe('hello');
  });
});
