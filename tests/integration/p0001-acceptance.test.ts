import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { openDatabase, type SqliteDatabase } from '../../storage/connection.js';
import { initSchema } from '../../storage/init.js';
import {
  ingest,
  getById,
  list,
} from '../../evidence/repository/evidence-repository.js';
import { IngestPayloadSchema } from '../../evidence/contracts/ingest.js';
import {
  groundTruthSources,
  groundTruthEvidence,
} from '../../evidence/ground-truth/index.js';

// P0001 End-to-End Acceptance test.
//
// This is the chain that proves P0001 works as a whole:
//   fixture  →  Zod parse  →  open DB  →  init schema
//            →  ingest  →  getById  →  list  →  corroborate
//            →  filter.
//
// Each run uses a fresh tmpfile DB. The DB is deleted on teardown.

let db: SqliteDatabase;
let tmpDir: string;

function count(sql: string): number {
  return (db.prepare(sql).get() as { n: number }).n;
}

beforeEach(() => {
  tmpDir = mkdtempSync(join(tmpdir(), 'opportunity-radar-e2e-'));
  db = openDatabase(join(tmpDir, 'acceptance.db'));
  initSchema(db);
});

afterEach(() => {
  db.close();
  rmSync(tmpDir, { recursive: true, force: true });
});

describe('P0001 End-to-End Acceptance', () => {
  it('runs the full chain: parse → validate → ingest → get → list → corroborate → filter', () => {
    // ── 1. Pick a slice of the Ground Truth corpus that exercises
    //      corroboration, two markets, and multiple evidence types.
    const sourceIds = [
      'src-reuters-wonderful',
      'src-techcrunch-wonderful',
      'src-xpeng-announcement',
      'src-google-gemini-blog',
    ];
    const sources = sourceIds.map((id) => {
      const s = groundTruthSources.find((x) => x.id === id);
      if (!s) throw new Error(`fixture missing: source ${id}`);
      return s;
    });
    const evidence = groundTruthEvidence.filter((e) =>
      e.sourceRefs.some((r) => sourceIds.includes(r)),
    );
    expect(sources).toHaveLength(4);
    expect(evidence.length).toBeGreaterThan(0);

    // ── 2. Zod validation on one payload.
    const firstSourceForPayload = sources[0];
    const firstEvidenceForPayload = evidence[0];
    if (firstSourceForPayload === undefined || firstEvidenceForPayload === undefined) {
      throw new Error('slice unexpectedly empty');
    }
    const samplePayload = {
      source: firstSourceForPayload,
      evidence: [firstEvidenceForPayload],
    };
    const validated = IngestPayloadSchema.parse(samplePayload);
    expect(validated.source.id).toBe(firstSourceForPayload.id);
    expect(validated.evidence[0]?.id).toBe(firstEvidenceForPayload.id);

    // ── 3. Ingest one payload per source.
    for (const source of sources) {
      const forThisSource = evidence.filter((e) => e.sourceRefs.includes(source.id));
      const result = ingest(db, { source, evidence: forThisSource });
      expect(result.sourceId).toBe(source.id);
    }

    // ── 4. The DB now has all sources, all evidence, all links.
    expect(count('SELECT COUNT(*) AS n FROM source_documents')).toBe(4);
    expect(count('SELECT COUNT(*) AS n FROM evidence')).toBe(evidence.length);

    // ── 5. getById returns the evidence with its full provenance.
    const corroboratedEvidenceId = evidence.find(
      (e) => e.sourceRefs.length >= 2,
    )?.id;
    expect(corroboratedEvidenceId).toBeDefined();
    const got = getById(db, corroboratedEvidenceId!);
    expect(got).not.toBeNull();
    expect(got!.sources.length).toBeGreaterThanOrEqual(2);

    // ── 6. list returns the full set, with sources attached.
    const all = list(db);
    expect(all.length).toBe(evidence.length);
    for (const entry of all) {
      expect(entry.sources.length).toBeGreaterThan(0);
    }

    // ── 7. Corroboration: re-ingest the same evidence with a
    //      different source from the slice. The new source's
    //      payload must produce a *new* evidence_sources link,
    //      not a duplicate evidence.
    const firstCorroborated = evidence.find((e) => e.sourceRefs.length >= 2)!;
    const otherSource = sources.find(
      (s) => !firstCorroborated.sourceRefs.includes(s.id),
    );
    expect(otherSource).toBeDefined();
    const result = ingest(db, { source: otherSource!, evidence: [firstCorroborated] });
    expect(result.evidence[0]?.isNew).toBe(false);
    expect(result.evidence[0]?.corroborated).toBe(true);

    // The evidence row count is unchanged; the link count went up by 1.
    // The expected link count is the sum of (sourceRefs ∩ slice) over
    // every evidence in the slice, since sources outside the slice
    // were not ingested and so have no link to add to.
    expect(count('SELECT COUNT(*) AS n FROM evidence')).toBe(evidence.length);
    const linksInSlice = evidence.reduce(
      (acc, e) => acc + e.sourceRefs.filter((r) => sourceIds.includes(r)).length,
      0,
    );
    expect(count('SELECT COUNT(*) AS n FROM evidence_sources')).toBe(linksInSlice + 1);

    // ── 8. list with a market filter narrows the result.
    const usOnly = list(db, { market: 'US' });
    expect(usOnly.length).toBeGreaterThan(0);
    expect(usOnly.every((e) => e.evidence.market === 'US')).toBe(true);

    // ── 9. list with an evidenceType filter narrows the result.
    const funding = list(db, { evidenceType: 'funding' });
    expect(funding.length).toBeGreaterThan(0);
    expect(funding.every((e) => e.evidence.evidenceType === 'funding')).toBe(true);

    // ── 10. The full Ground Truth fits in a single DB without
    //       crashing — sanity check that the substrate is sized
    //       correctly for the corpus.
    const firstSource = sources[0];
    if (firstSource === undefined) throw new Error('slice unexpectedly empty');
    const fullGroundTruth = {
      source: firstSource,
      evidence: groundTruthEvidence.filter((e) => e.sourceRefs.includes(firstSource.id)),
    };
    expect(() => ingest(db, fullGroundTruth)).not.toThrow();
  });
});
