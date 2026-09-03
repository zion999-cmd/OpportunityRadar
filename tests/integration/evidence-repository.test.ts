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
  type IngestResult,
} from '../../evidence/repository/evidence-repository.js';
import type { IngestPayload } from '../../evidence/contracts/ingest.js';
import type { Evidence } from '../../evidence/contracts/evidence.js';
import type { SourceDocument } from '../../evidence/contracts/source-document.js';
import { groundTruthSources, groundTruthEvidence } from '../../evidence/ground-truth/index.js';

// Integration tests for the Evidence Repository.
//
// Each test gets a fresh tmpfile SQLite DB. The repository's
// promises — atomicity, conservative dedup, corroboration,
// append-only history — are validated end-to-end against the
// Ground Truth fixtures.

let db: SqliteDatabase;
let tmpDir: string;

function findSource(id: string): SourceDocument {
  const s = groundTruthSources.find((x) => x.id === id);
  if (!s) throw new Error(`fixture missing: source ${id}`);
  return s;
}

function findEvidence(id: string): Evidence {
  const e = groundTruthEvidence.find((x) => x.id === id);
  if (!e) throw new Error(`fixture missing: evidence ${id}`);
  return e;
}

function count(sql: string): number {
  const row = db.prepare(sql).get() as { n: number };
  return row.n;
}

beforeEach(() => {
  tmpDir = mkdtempSync(join(tmpdir(), 'opportunity-radar-test-'));
  db = openDatabase(join(tmpDir, 'test.db'));
  initSchema(db);
});

afterEach(() => {
  db.close();
  rmSync(tmpDir, { recursive: true, force: true });
});

// ─── ingest — happy path ────────────────────────────────────────────

describe('EvidenceRepository.ingest — happy path', () => {
  it('persists 1 source and 2 evidence, returns isNew=true for both', () => {
    // Arrange
    const payload: IngestPayload = {
      source: findSource('src-reuters-wonderful'),
      evidence: [findEvidence('ev-wonderful-series-c'), findEvidence('ev-wonderful-valuation')],
    };

    // Act
    const result: IngestResult = ingest(db, payload);

    // Assert — return value
    expect(result.sourceId).toBe(payload.source.id);
    expect(result.sourceIsNew).toBe(true);
    expect(result.evidence).toHaveLength(2);
    expect(result.evidence.every((e) => e.isNew && !e.corroborated)).toBe(true);

    // Assert — DB rows
    expect(count('SELECT COUNT(*) AS n FROM source_documents')).toBe(1);
    expect(count('SELECT COUNT(*) AS n FROM evidence')).toBe(2);
    expect(count('SELECT COUNT(*) AS n FROM evidence_sources')).toBe(2);
  });
});

// ─── ingest — atomicity / rollback ──────────────────────────────────

describe('EvidenceRepository.ingest — atomicity', () => {
  it('writes zero rows when Zod validation fails on the payload', () => {
    // Arrange: a payload that fails Zod (empty claim) on the second
    // field. The repository should throw before any DB write.
    const payload = {
      source: findSource('src-reuters-wonderful'),
      evidence: [
        { ...findEvidence('ev-wonderful-series-c'), claim: '' },
      ],
    } as unknown as IngestPayload;

    // Act / Assert
    expect(() => ingest(db, payload)).toThrow();

    // Assert — DB is untouched
    expect(count('SELECT COUNT(*) AS n FROM source_documents')).toBe(0);
    expect(count('SELECT COUNT(*) AS n FROM evidence')).toBe(0);
    expect(count('SELECT COUNT(*) AS n FROM evidence_sources')).toBe(0);
  });

  it('writes zero rows when the source INSERT fails (id collision with existing source)', () => {
    // Arrange: insert one source with id "src-reuters-wonderful".
    // Then attempt to insert a different source with the same id
    // (but a different canonicalUrl) inside a fresh transaction.
    // The UNIQUE on id will cause the second insert to fail; the
    // transaction must roll back any partial state from that call.
    ingest(db, {
      source: findSource('src-reuters-wonderful'),
      evidence: [findEvidence('ev-wonderful-series-c')],
    });

    const collidingSource: SourceDocument = {
      ...findSource('src-reuters-wonderful'),
      canonicalUrl: 'https://different.example.com/elsewhere',
    };

    // Act / Assert: a second payload with the same source ID but
    // a *different* URL is an inconsistent input. The repository
    // should refuse rather than silently overwriting. We assert
    // that ingest throws (id collision at the SQL layer).
    expect(() => ingest(db, { source: collidingSource, evidence: [findEvidence('ev-wonderful-valuation')] })).toThrow();

    // Assert: original data is intact, no extra evidence leaked
    expect(count('SELECT COUNT(*) AS n FROM source_documents')).toBe(1);
    expect(count('SELECT COUNT(*) AS n FROM evidence')).toBe(1);
    expect(count('SELECT COUNT(*) AS n FROM evidence_sources')).toBe(1);
  });
});

// ─── ingest — source dedup ──────────────────────────────────────────

describe('EvidenceRepository.ingest — source dedup', () => {
  it('does not duplicate a source when its normalized canonicalUrl matches an existing one', () => {
    // Arrange: first payload with a clean URL; second payload with
    // the *same* logical source but a different surface form
    // (uppercase protocol + trailing slash). The repository
    // should normalize the URL and find the existing source.
    const source1 = findSource('src-reuters-wonderful');
    const source2: SourceDocument = {
      ...source1,
      canonicalUrl: 'HTTPS://www.reuters.com/article/wonderful-series-c-2026/',
    };

    // Act
    ingest(db, { source: source1, evidence: [findEvidence('ev-wonderful-series-c')] });
    const result = ingest(db, { source: source2, evidence: [findEvidence('ev-wonderful-valuation')] });

    // Assert
    expect(result.sourceIsNew).toBe(false);
    expect(count('SELECT COUNT(*) AS n FROM source_documents')).toBe(1);
    // Two distinct evidence with different claims → both stored
    expect(count('SELECT COUNT(*) AS n FROM evidence')).toBe(2);
  });
});

// ─── ingest — evidence dedup ────────────────────────────────────────

describe('EvidenceRepository.ingest — evidence dedup', () => {
  it('does not duplicate evidence when the fingerprint matches an existing one', () => {
    // Arrange: same evidence fixture, two different sources.
    // The second ingest should find the existing evidence by
    // fingerprint and skip the insert.
    ingest(db, {
      source: findSource('src-reuters-wonderful'),
      evidence: [findEvidence('ev-wonderful-series-c')],
    });
    ingest(db, {
      source: findSource('src-techcrunch-wonderful'),
      evidence: [findEvidence('ev-wonderful-series-c')],
    });

    // Assert
    expect(count('SELECT COUNT(*) AS n FROM evidence')).toBe(1);
    // But the join table should have two rows (one per source)
    expect(count('SELECT COUNT(*) AS n FROM evidence_sources')).toBe(2);
    // And both sources should be present
    expect(count('SELECT COUNT(*) AS n FROM source_documents')).toBe(2);
  });
});

// ─── ingest — corroboration ─────────────────────────────────────────

describe('EvidenceRepository.ingest — corroboration', () => {
  it('attaches a new source to an existing evidence and reports corroborated=true', () => {
    // Act
    const first = ingest(db, {
      source: findSource('src-reuters-wonderful'),
      evidence: [findEvidence('ev-wonderful-series-c')],
    });
    const second = ingest(db, {
      source: findSource('src-techcrunch-wonderful'),
      evidence: [findEvidence('ev-wonderful-series-c')],
    });

    // Assert
    expect(first.evidence[0]?.isNew).toBe(true);
    expect(first.evidence[0]?.corroborated).toBe(false);

    expect(second.evidence[0]?.isNew).toBe(false);
    expect(second.evidence[0]?.corroborated).toBe(true);

    // The new source is a fresh insert — it's the *evidence* that's
    // corroborated, not the source.
    expect(second.sourceIsNew).toBe(true);

    // Final state
    expect(count('SELECT COUNT(*) AS n FROM evidence')).toBe(1);
    expect(count('SELECT COUNT(*) AS n FROM source_documents')).toBe(2);
    expect(count('SELECT COUNT(*) AS n FROM evidence_sources')).toBe(2);
  });
});

// ─── getById ────────────────────────────────────────────────────────

describe('EvidenceRepository.getById', () => {
  it('returns the evidence plus its full source provenance', () => {
    // Arrange
    ingest(db, {
      source: findSource('src-reuters-wonderful'),
      evidence: [findEvidence('ev-wonderful-series-c')],
    });
    ingest(db, {
      source: findSource('src-techcrunch-wonderful'),
      evidence: [findEvidence('ev-wonderful-series-c')],
    });

    // Act
    const result = getById(db, 'ev-wonderful-series-c');

    // Assert
    expect(result).not.toBeNull();
    expect(result?.evidence.id).toBe('ev-wonderful-series-c');
    expect(result?.evidence.claim).toBe(findEvidence('ev-wonderful-series-c').claim);
    expect(result?.sources).toHaveLength(2);
    const sourceIds = result?.sources.map((s) => s.id).sort();
    expect(sourceIds).toEqual(['src-reuters-wonderful', 'src-techcrunch-wonderful']);
  });

  it('returns null for an unknown id', () => {
    expect(getById(db, 'does-not-exist')).toBeNull();
  });
});

// ─── list ───────────────────────────────────────────────────────────

describe('EvidenceRepository.list', () => {
  beforeEach(() => {
    // Seed: one evidence per market, one of each interesting type.
    ingest(db, {
      source: findSource('src-reuters-wonderful'),
      evidence: [findEvidence('ev-wonderful-series-c')], // US, funding
    });
    ingest(db, {
      source: findSource('src-xpeng-announcement'),
      evidence: [findEvidence('ev-xpeng-raise')], // CN, funding
    });
    ingest(db, {
      source: findSource('src-google-gemini-blog'),
      evidence: [findEvidence('ev-gemini-launch')], // US, product_launch
    });
  });

  it('returns all evidence when no filter is given', () => {
    const all = list(db);
    expect(all).toHaveLength(3);
    // Every entry has its supporting sources attached
    for (const entry of all) {
      expect(entry.sources.length).toBeGreaterThan(0);
    }
  });

  it('filters by market', () => {
    const us = list(db, { market: 'US' });
    const cn = list(db, { market: 'CN' });

    expect(us).toHaveLength(2);
    expect(us.every((e) => e.evidence.market === 'US')).toBe(true);

    expect(cn).toHaveLength(1);
    expect(cn.every((e) => e.evidence.market === 'CN')).toBe(true);
  });

  it('filters by evidenceType', () => {
    const funding = list(db, { evidenceType: 'funding' });
    expect(funding).toHaveLength(2);
    expect(funding.every((e) => e.evidence.evidenceType === 'funding')).toBe(true);
  });

  it('combines market and evidenceType filters', () => {
    const usFunding = list(db, { market: 'US', evidenceType: 'funding' });
    expect(usFunding).toHaveLength(1);
    expect(usFunding[0]?.evidence.id).toBe('ev-wonderful-series-c');
  });
});

// ─── contradiction preservation ─────────────────────────────────────

describe('EvidenceRepository — contradiction preservation', () => {
  it('preserves contradicting claims as separate evidence (not overwritten)', () => {
    // Arrange: two different claims about the same event. Each has
    // its own id (the spread above only carries shape, not id) and
    // its own claim, so each will get a different fingerprint and
    // be stored separately.
    const source = findSource('src-reuters-wonderful');
    const claimA: Evidence = {
      ...findEvidence('ev-wonderful-series-c'),
      id: 'ev-wonderful-contradiction-A',
      claim: 'Wonderful raised $500M.',
    };
    const claimB: Evidence = {
      ...findEvidence('ev-wonderful-series-c'),
      id: 'ev-wonderful-contradiction-B',
      claim: 'Wonderful raised $600M.',
    };

    // Act
    ingest(db, { source, evidence: [claimA] });
    ingest(db, { source, evidence: [claimB] });

    // Assert — both are preserved, both readable back
    const all = list(db);
    const claims = all.map((e) => e.evidence.claim).sort();
    expect(claims).toEqual(['Wonderful raised $500M.', 'Wonderful raised $600M.']);

    // The first claim is not overwritten
    const retrieved = getById(db, claimA.id);
    expect(retrieved?.evidence.claim).toBe('Wonderful raised $500M.');
  });
});
