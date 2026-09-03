// Schema DDL for the P0001 Evidence Foundation.
//
// Per P0001 §Storage Substrate:
// - source_documents — unique on canonical_url (normalized form)
// - evidence         — unique on fingerprint
// - evidence_sources — many-to-many join; one Evidence can be
//                      supported by N SourceDocuments, and one
//                      SourceDocument can underwrite M Evidence
// - schema_version   — minimum-viable version tracking; not a
//                      migration framework
//
// All DDL is idempotent (`IF NOT EXISTS`) so `initSchema` can be
// called against a fresh or an already-initialized DB without
// erroring. The `schema_version` table itself is created
// separately by `initSchema` before any version check.

export const SCHEMA_VERSION = 1 as const;

export const V1_DDL: readonly string[] = [
  `CREATE TABLE IF NOT EXISTS source_documents (
     id              TEXT PRIMARY KEY,
     source_type     TEXT NOT NULL,
     publisher       TEXT NOT NULL,
     title           TEXT NOT NULL,
     canonical_url   TEXT NOT NULL UNIQUE,
     published_at    TEXT,
     accessed_at     TEXT,
     language        TEXT NOT NULL,
     market          TEXT NOT NULL,
     created_at      TEXT NOT NULL
   )`,

  `CREATE TABLE IF NOT EXISTS evidence (
     id              TEXT PRIMARY KEY,
     claim           TEXT NOT NULL,
     subject         TEXT NOT NULL,
     evidence_type   TEXT NOT NULL,
     event_at        TEXT,
     observed_at     TEXT NOT NULL,
     market          TEXT NOT NULL,
     confidence      TEXT NOT NULL,
     fingerprint     TEXT NOT NULL UNIQUE,
     metadata_json   TEXT,
     created_at      TEXT NOT NULL
   )`,

  `CREATE TABLE IF NOT EXISTS evidence_sources (
     evidence_id     TEXT NOT NULL,
     source_id       TEXT NOT NULL,
     PRIMARY KEY (evidence_id, source_id),
     FOREIGN KEY (evidence_id) REFERENCES evidence(id)          ON DELETE CASCADE,
     FOREIGN KEY (source_id)   REFERENCES source_documents(id)  ON DELETE CASCADE
   )`,

  `CREATE INDEX IF NOT EXISTS idx_evidence_market        ON evidence(market)`,
  `CREATE INDEX IF NOT EXISTS idx_evidence_type         ON evidence(evidence_type)`,
  `CREATE INDEX IF NOT EXISTS idx_evidence_observed_at   ON evidence(observed_at)`,
  `CREATE INDEX IF NOT EXISTS idx_evidence_sources_sid  ON evidence_sources(source_id)`,
];
