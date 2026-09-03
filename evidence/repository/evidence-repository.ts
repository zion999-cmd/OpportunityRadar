import type { SqliteDatabase } from '../../storage/connection.js';
import { IngestPayloadSchema, type IngestPayload } from '../contracts/ingest.js';
import type { SourceDocument, Market } from '../contracts/source-document.js';
import type { Evidence } from '../contracts/evidence.js';
import { normalizeUrl } from '../normalization/url.js';
import { evidenceFingerprint } from '../normalization/evidence-fingerprint.js';

// EvidenceRepository — the only write/read path for SourceDocument
// and Evidence. Per P0001 §Repository Contract:
//
//   - Conservative dedup:
//       * source_documents unique on normalized canonical_url
//       * evidence unique on fingerprint
//   - Corroboration: a new source supporting an existing evidence
//     inserts only the evidence_sources link; the evidence row is
//     NOT overwritten.
//   - Append-only: contradictions are stored as separate evidence
//     records (different fingerprint), never as updates.
//   - Atomicity: every ingest is one SQLite transaction; any
//     throw rolls back the whole call.
//
// All exported functions take an open SqliteDatabase handle. There
// is no hidden global state — the repository does not own the
// connection. Tests, scripts, and any future runtime caller all
// share the same explicit "open then use" pattern.

// ─── Public types ────────────────────────────────────────────────────

export interface IngestEvidenceResult {
  id: string;
  isNew: boolean;
  corroborated: boolean;
}

export interface IngestResult {
  sourceId: string;
  sourceIsNew: boolean;
  evidence: IngestEvidenceResult[];
}

export interface EvidenceWithSources {
  evidence: Evidence;
  sources: SourceDocument[];
}

export interface ListOptions {
  market?: Market;
  evidenceType?: string;
}

// ─── SQL ─────────────────────────────────────────────────────────────

const FIND_SOURCE_SQL = `SELECT * FROM source_documents WHERE canonical_url = ?`;

const INSERT_SOURCE_SQL = `
  INSERT INTO source_documents (
    id, source_type, publisher, title, canonical_url,
    published_at, accessed_at, language, market, created_at
  ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
`;

const FIND_EVIDENCE_BY_FP_SQL = `SELECT * FROM evidence WHERE fingerprint = ?`;

const INSERT_EVIDENCE_SQL = `
  INSERT INTO evidence (
    id, claim, subject, evidence_type, event_at,
    observed_at, market, confidence, fingerprint, metadata_json, created_at
  ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
`;

const FIND_LINK_SQL = `SELECT 1 FROM evidence_sources WHERE evidence_id = ? AND source_id = ?`;

const INSERT_LINK_SQL = `INSERT INTO evidence_sources (evidence_id, source_id) VALUES (?, ?)`;

const FIND_EVIDENCE_BY_ID_SQL = `SELECT * FROM evidence WHERE id = ?`;

const FIND_SOURCES_FOR_EVIDENCE_SQL = `
  SELECT s.* FROM source_documents s
  INNER JOIN evidence_sources es ON es.source_id = s.id
  WHERE es.evidence_id = ?
  ORDER BY s.id
`;

// ─── Row types (snake_case from SQLite) ──────────────────────────────

interface SourceRow {
  id: string;
  source_type: string;
  publisher: string;
  title: string;
  canonical_url: string;
  published_at: string | null;
  accessed_at: string | null;
  language: string;
  market: string;
  created_at: string;
}

interface EvidenceRow {
  id: string;
  claim: string;
  subject: string;
  evidence_type: string;
  event_at: string | null;
  observed_at: string;
  market: string;
  confidence: string;
  fingerprint: string;
  metadata_json: string | null;
  created_at: string;
}

// ─── Row → contract mappers ─────────────────────────────────────────

function rowToSource(row: SourceRow): SourceDocument {
  return {
    id: row.id,
    sourceType: row.source_type as SourceDocument['sourceType'],
    publisher: row.publisher,
    title: row.title,
    canonicalUrl: row.canonical_url,
    publishedAt: row.published_at,
    accessedAt: row.accessed_at,
    language: row.language as SourceDocument['language'],
    market: row.market as SourceDocument['market'],
  };
}

function rowToEvidence(row: EvidenceRow): Evidence {
  const base: Evidence = {
    id: row.id,
    claim: row.claim,
    subject: row.subject,
    evidenceType: row.evidence_type as Evidence['evidenceType'],
    eventAt: row.event_at,
    observedAt: row.observed_at,
    market: row.market as Evidence['market'],
    confidence: row.confidence as Evidence['confidence'],
    sourceRefs: [],
  };
  if (row.metadata_json !== null) {
    const parsed: Record<string, unknown> = JSON.parse(row.metadata_json) as Record<string, unknown>;
    return { ...base, metadata: parsed };
  }
  return base;
}

// ─── Helpers ─────────────────────────────────────────────────────────

function fingerprintOf(evidence: Evidence): string {
  return evidenceFingerprint({
    subject: evidence.subject,
    claim: evidence.claim,
    eventAt: evidence.eventAt,
    market: evidence.market,
  });
}

// ─── Public API ──────────────────────────────────────────────────────

export function ingest(db: SqliteDatabase, payload: IngestPayload): IngestResult {
  // 1. Validate at the boundary. If the payload is invalid, throw
  //    before the transaction starts — there is nothing to roll
  //    back, and the DB stays untouched.
  const validated = IngestPayloadSchema.parse(payload);

  // 2. Normalize the source URL up-front. All dedup decisions and
  //    the row that ends up in the DB use the canonical form.
  const normalizedSource: SourceDocument = {
    ...validated.source,
    canonicalUrl: normalizeUrl(validated.source.canonicalUrl),
  };

  const now = new Date().toISOString();

  // 3. Run the whole ingest in a single transaction. If any step
  //    throws, every prior write is rolled back automatically.
  const run = db.transaction((): IngestResult => {
    // 3a. Find or insert the source by normalized canonicalUrl.
    const existingSource = db
      .prepare(FIND_SOURCE_SQL)
      .get(normalizedSource.canonicalUrl) as SourceRow | undefined;
    let sourceId: string;
    let sourceIsNew: boolean;
    if (existingSource) {
      sourceId = existingSource.id;
      sourceIsNew = false;
    } else {
      db.prepare(INSERT_SOURCE_SQL).run(
        normalizedSource.id,
        normalizedSource.sourceType,
        normalizedSource.publisher,
        normalizedSource.title,
        normalizedSource.canonicalUrl,
        normalizedSource.publishedAt,
        normalizedSource.accessedAt,
        normalizedSource.language,
        normalizedSource.market,
        now,
      );
      sourceId = normalizedSource.id;
      sourceIsNew = true;
    }

    // 3b. For each evidence: fingerprint, find-or-insert, link.
    const evidenceResults: IngestEvidenceResult[] = [];
    for (const ev of validated.evidence) {
      const fp = fingerprintOf(ev);
      const existingEvidence = db
        .prepare(FIND_EVIDENCE_BY_FP_SQL)
        .get(fp) as EvidenceRow | undefined;

      let evidenceId: string;
      let isNew: boolean;
      if (existingEvidence) {
        evidenceId = existingEvidence.id;
        isNew = false;
      } else {
        db.prepare(INSERT_EVIDENCE_SQL).run(
          ev.id,
          ev.claim,
          ev.subject,
          ev.evidenceType,
          ev.eventAt,
          ev.observedAt,
          ev.market,
          ev.confidence,
          fp,
          ev.metadata !== undefined ? JSON.stringify(ev.metadata) : null,
          now,
        );
        evidenceId = ev.id;
        isNew = true;
      }

      // 3c. Insert the (evidence, source) link if it isn't there.
      //    `corroborated` is true only when we inserted a new link
      //    against an *already known* evidence — that is what
      //    "this source corroborates an existing fact" means.
      const linkExists = db
        .prepare(FIND_LINK_SQL)
        .get(evidenceId, sourceId) as { 1: number } | undefined;
      let corroborated = false;
      if (linkExists === undefined) {
        db.prepare(INSERT_LINK_SQL).run(evidenceId, sourceId);
        corroborated = !isNew;
      }

      evidenceResults.push({ id: evidenceId, isNew, corroborated });
    }

    return { sourceId, sourceIsNew, evidence: evidenceResults };
  });

  return run();
}

export function getById(db: SqliteDatabase, id: string): EvidenceWithSources | null {
  const evRow = db
    .prepare(FIND_EVIDENCE_BY_ID_SQL)
    .get(id) as EvidenceRow | undefined;
  if (evRow === undefined) {
    return null;
  }
  const sourceRows = db
    .prepare(FIND_SOURCES_FOR_EVIDENCE_SQL)
    .all(id) as SourceRow[];
  return {
    evidence: rowToEvidence(evRow),
    sources: sourceRows.map(rowToSource),
  };
}

export function list(db: SqliteDatabase, options: ListOptions = {}): EvidenceWithSources[] {
  const conditions: string[] = [];
  const params: string[] = [];
  if (options.market !== undefined) {
    conditions.push('market = ?');
    params.push(options.market);
  }
  if (options.evidenceType !== undefined) {
    conditions.push('evidence_type = ?');
    params.push(options.evidenceType);
  }
  const where = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';
  // Stable ordering: most recent observation first, then id to
  // break ties.
  const sql = `SELECT * FROM evidence ${where} ORDER BY observed_at DESC, id ASC`;
  const evidenceRows = db.prepare(sql).all(...params) as EvidenceRow[];

  return evidenceRows.map((row) => {
    const sourceRows = db
      .prepare(FIND_SOURCES_FOR_EVIDENCE_SQL)
      .all(row.id) as SourceRow[];
    return {
      evidence: rowToEvidence(row),
      sources: sourceRows.map(rowToSource),
    };
  });
}
