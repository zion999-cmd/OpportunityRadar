// apps/recruiting-exhibit/views.ts — read-side queries that
// back the four single-page sections.
//
// Per task.md, the page shows:
//   1. Current Situation
//   2. Observation Status (last / next / new evidence / new relationship / last error)
//   3. Relationship Inbox (only `surface` decisions)
//   4. Observation Feed (recent Evidence with surfaced / not surfaced)
//
// All queries are read-only and use prepared statements. The
// `feedUrl` field is surfaced so the UI can link both the
// originating feed AND the article (postmortem) itself — the
// audit fix #2 requirement that the user can click the real
// source-item URL, not just the feed URL.

import type { SqliteDatabase } from '../../storage/connection.js';

export interface ObservationStatus {
  readonly lastObservationAt: string | null;
  readonly lastRunStatus: 'running' | 'succeeded' | 'failed' | null;
  readonly nextObservationAt: string | null;
  readonly newEvidenceCount: number;
  readonly newRelationshipCount: number;
  readonly totalSurfaces: number;
  /**
   * Total reconstructed-evidence rows currently stored. The
   * Surface uses this as an honest aggregate ("Recovered
   * Evidence") instead of fabricating per-category counts.
   */
  readonly totalEvidenceCount: number;
  /**
   * Error summary from the most recent run, if any. Audit fix
   * #3: partial failure is observable. `null` means the most
   * recent run completed with no errors recorded.
   */
  readonly lastError: string | null;
}

export interface InboxEntry {
  readonly relationshipId: string;
  readonly evidenceId: string;
  readonly sourceLabel: string;
  /** Article / postmortem URL — what the user actually clicks. */
  readonly sourceUrl: string;
  /** Originating feed URL — surfaced alongside the article link. */
  readonly feedUrl: string;
  /**
   * Feed item title as captured. Read-only field added for the
   * magazine Surface: the Semantic Card evidence preview and
   * the detail-page Evidence section need a human-readable
   * source title in addition to the reconstructed claim.
   */
  readonly sourceTitle: string;
  /**
   * Raw feed excerpt. Read-only field added for the Surface:
   * the detail-page Evidence section (the Trust Layer) shows
   * the source excerpt next to the clickable article URL.
   */
  readonly rawExcerpt: string;
  readonly claim: string;
  /**
   * Stage-2 reconstructed interpretation of the Evidence. The
   * Surface maps this to the card's short semantic summary.
   */
  readonly impliedMeaning: string;
  readonly whyRelevant: string;
  readonly evidenceUsed: string;
  readonly mostImportantUnknown: string;
  readonly surfacedAt: string;
}

export interface FeedEntry {
  readonly evidenceId: string;
  readonly sourceLabel: string;
  readonly sourceUrl: string;
  readonly feedUrl: string;
  readonly claim: string;
  readonly impliedMeaning: string;
  readonly relationshipStatus: 'surfaced' | 'not_surfaced';
  readonly capturedAt: string;
}

export interface ScheduleConfig {
  /** Interval (ms) between scheduled observation runs. */
  readonly intervalMs: number;
}

const LAST_RUN_SQL = `
  SELECT started_at, status, error_message FROM exhibit_observation_runs
  ORDER BY started_at DESC LIMIT 1
`;
const LATEST_RUN_COUNTS_SQL = `
  SELECT new_evidence_count, new_relationship_count FROM exhibit_observation_runs
  ORDER BY started_at DESC LIMIT 1
`;
const TOTAL_SURFACED_SQL = `
  SELECT COUNT(*) AS c FROM exhibit_relationship_results WHERE surface_decision = 'surface'
`;
const TOTAL_EVIDENCE_SQL = `
  SELECT COUNT(*) AS c FROM exhibit_reconstructed_evidence
`;
const INBOX_SQL = `
  SELECT
    r.id              AS relationshipId,
    r.evidence_id     AS evidenceId,
    s.source_label    AS sourceLabel,
    s.source_url      AS sourceUrl,
    s.feed_url        AS feedUrl,
    COALESCE(s.title, '') AS sourceTitle,
    s.raw_excerpt     AS rawExcerpt,
    e.claim           AS claim,
    e.implied_meaning AS impliedMeaning,
    r.why_relevant    AS whyRelevant,
    r.evidence_used   AS evidenceUsed,
    r.most_important_unknown AS mostImportantUnknown,
    r.surfaced_at     AS surfacedAt
  FROM exhibit_relationship_results r
  JOIN exhibit_reconstructed_evidence e ON e.id = r.evidence_id
  JOIN exhibit_source_items s          ON s.id = e.source_item_id
  WHERE r.surface_decision = 'surface'
  ORDER BY r.surfaced_at DESC
  LIMIT 50
`;
const FEED_SQL = `
  SELECT
    e.id                AS evidenceId,
    s.source_label      AS sourceLabel,
    s.source_url        AS sourceUrl,
    s.feed_url          AS feedUrl,
    e.claim             AS claim,
    e.implied_meaning   AS impliedMeaning,
    CASE
      WHEN r.id IS NULL THEN 'not_surfaced'
      WHEN r.surface_decision = 'surface' THEN 'surfaced'
      ELSE 'not_surfaced'
    END                 AS relationshipStatus,
    COALESCE(r.surfaced_at, e.created_at) AS capturedAt
  FROM exhibit_reconstructed_evidence e
  JOIN exhibit_source_items s ON s.id = e.source_item_id
  LEFT JOIN exhibit_relationship_results r ON r.evidence_id = e.id
  ORDER BY e.created_at DESC
  LIMIT 50
`;

/**
 * Read observation status. The `intervalMs` is required: the
 * next-observation time is `lastStarted + intervalMs`, and the
 * server is the only caller that knows the real interval.
 * There is no default — callers must pass the actual scheduled
 * interval.
 */
export function readStatus(db: SqliteDatabase, schedule: ScheduleConfig): ObservationStatus {
  const last = db.prepare(LAST_RUN_SQL).get() as { started_at: string; status: 'running' | 'succeeded' | 'failed'; error_message: string | null } | undefined;
  const counts = db.prepare(LATEST_RUN_COUNTS_SQL).get() as { new_evidence_count: number; new_relationship_count: number } | undefined;
  const totalSurfaced = (db.prepare(TOTAL_SURFACED_SQL).get() as { c: number } | undefined)?.c ?? 0;
  const totalEvidence = (db.prepare(TOTAL_EVIDENCE_SQL).get() as { c: number } | undefined)?.c ?? 0;

  let nextObservationAt: string | null = null;
  if (last !== undefined) {
    const lastStart = Date.parse(last.started_at);
    if (Number.isFinite(lastStart)) {
      nextObservationAt = new Date(lastStart + schedule.intervalMs).toISOString();
    }
  }

  return {
    lastObservationAt: last?.started_at ?? null,
    lastRunStatus: last?.status ?? null,
    nextObservationAt,
    newEvidenceCount: counts?.new_evidence_count ?? 0,
    newRelationshipCount: counts?.new_relationship_count ?? 0,
    totalSurfaces: totalSurfaced,
    totalEvidenceCount: totalEvidence,
    lastError: last?.error_message ?? null,
  };
}

export function readInbox(db: SqliteDatabase): ReadonlyArray<InboxEntry> {
  return db.prepare(INBOX_SQL).all() as InboxEntry[];
}

export function readFeed(db: SqliteDatabase): ReadonlyArray<FeedEntry> {
  return db.prepare(FEED_SQL).all() as FeedEntry[];
}

const INSERT_FEEDBACK_SQL = `
  INSERT INTO exhibit_feedback (id, relationship_id, button, recorded_at)
  VALUES (?, ?, ?, ?)
`;

export function recordFeedback(db: SqliteDatabase, relationshipId: string, button: 'worth_talking' | 'investigate_more' | 'not_relevant'): void {
  if (button !== 'worth_talking' && button !== 'investigate_more' && button !== 'not_relevant') {
    throw new Error(`unknown feedback button: ${button}`);
  }
  const recordedAt = new Date().toISOString();
  // Importing crypto at the top of the file would force Node-only
  // modules; this is a tiny UUID-v4 generator inlined here so the
  // file stays dependency-free at the import level.
  const id = inlineUuidV4();
  db.prepare(INSERT_FEEDBACK_SQL).run(id, relationshipId, button, recordedAt);
}

function inlineUuidV4(): string {
  // RFC 4122 v4 using Math.random — fine for a local-exhibit
  // primary key, not a cryptographic identifier.
  const hex = '0123456789abcdef';
  let out = '';
  for (let i = 0; i < 32; i += 1) {
    if (i === 8 || i === 12 || i === 16 || i === 20) out += '-';
    if (i === 12) { out += '4'; continue; }
    if (i === 16) { out += hex[(Math.random() * 4) | 0 | 8]; continue; }
    out += hex[(Math.random() * 16) | 0];
  }
  return out;
}
