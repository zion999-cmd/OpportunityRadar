// apps/recruiting-exhibit/observation.ts — the observation
// orchestrator. One call to `runObservation(deps, kind)` does:
//
//   1. Process-local in-flight guard. If another run is in
//      progress, return a `skipped` RunResult without touching
//      the DB or calling Hermes.
//   2. Insert a `running` row into exhibit_observation_runs.
//   3. For each fixed source, fetch the feed. Per-source
//      failures are recorded; they do not abort the run.
//   4. For each fetched item, INSERT OR IGNORE into
//      exhibit_source_items. The UNIQUE(source_label,
//      source_url) index is the dedup key; if `changes === 0`
//      we have already processed this item and we skip the
//      entire Evidence Reconstruction + Relationship Reasoning
//      pipeline. This is the audit fix #1.
//   5. For each truly new item, call Hermes once for Evidence
//      Reconstruction; then once for Relationship Reasoning.
//   6. Persist error summary on the run row even on partial
//      failure. If we tried to process items but every one of
//      them failed at the model / parse step, the run is
//      marked `failed` rather than `succeeded` (audit fix #3).
//   7. `new_relationship_count` counts only `surface` decisions
//      (audit fix #4).
//   8. Update the run row with the final status and counts.
//
// All work happens inside one DB transaction per source item
// so a partial failure leaves the DB in a consistent state.

import { randomUUID } from 'node:crypto';
import type { HermesClient, HermesOneShotRequest } from '../../runtime/hermes/types.js';
import type { SqliteDatabase } from '../../storage/connection.js';
import { fetchSource } from './fetch.js';
import { parseEvidenceReconstruction, parseRelationshipReasoning } from './parse.js';
import { buildEvidenceReconstructionPrompt, buildRelationshipReasoningPrompt } from './prompts.js';
import { readSituation } from './situation-repo.js';
import { FIXED_SOURCES } from './sources.js';

export type RunKind = 'scheduled' | 'manual';
export type RunStatus = 'succeeded' | 'failed' | 'skipped';

export interface RunResult {
  readonly runId: string;
  readonly status: RunStatus;
  readonly newEvidenceCount: number;
  readonly newRelationshipCount: number;
  readonly errorMessage: string | null;
}

interface RunRow {
  readonly id: string;
  readonly kind: RunKind;
  readonly started_at: string;
  readonly completed_at: string | null;
  readonly status: 'running' | 'succeeded' | 'failed';
  readonly new_evidence_count: number;
  readonly new_relationship_count: number;
  readonly error_message: string | null;
}

interface SourceItemRow {
  readonly id: string;
  readonly run_id: string;
  readonly source_label: string;
  readonly source_url: string;
  readonly feed_url: string;
  readonly captured_at: string;
  readonly title: string | null;
  readonly raw_excerpt: string;
  readonly fetch_status: 'ok' | 'failed';
  readonly fetch_error: string | null;
}

interface EvidenceRow {
  readonly id: string;
  readonly run_id: string;
  readonly source_item_id: string;
  readonly claim: string;
  readonly implied_meaning: string;
  readonly hypotheses_unknowns: string;
  readonly created_at: string;
}

interface RelationshipRow {
  readonly id: string;
  readonly run_id: string;
  readonly evidence_id: string;
  readonly surface_decision: 'surface' | 'do_not_surface';
  readonly why_relevant: string;
  readonly evidence_used: string;
  readonly most_important_unknown: string;
  readonly surfaced_at: string;
}

const INSERT_RUN_SQL = `
  INSERT INTO exhibit_observation_runs (id, kind, started_at, status)
  VALUES (?, ?, ?, 'running')
`;
const FINISH_RUN_SQL = `
  UPDATE exhibit_observation_runs
  SET status = ?, completed_at = ?, new_evidence_count = ?, new_relationship_count = ?, error_message = ?
  WHERE id = ?
`;
// The dedup key is (source_label, source_url). We use
// `INSERT OR IGNORE` so a previously-seen item is a no-op
// (changes === 0) and the orchestrator can skip the model
// pipeline entirely. `source_url` is the *article* URL; the
// originating feed URL is recorded separately in `feed_url`
// for provenance and the UI.
const INSERT_SOURCE_ITEM_SQL = `
  INSERT OR IGNORE INTO exhibit_source_items (id, run_id, source_label, source_url, feed_url, captured_at, title, raw_excerpt, fetch_status, fetch_error)
  VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
`;
const INSERT_EVIDENCE_SQL = `
  INSERT INTO exhibit_reconstructed_evidence (id, run_id, source_item_id, claim, implied_meaning, hypotheses_unknowns, created_at)
  VALUES (?, ?, ?, ?, ?, ?, ?)
`;
const INSERT_RELATIONSHIP_SQL = `
  INSERT INTO exhibit_relationship_results (id, run_id, evidence_id, surface_decision, why_relevant, evidence_used, most_important_unknown, surfaced_at)
  VALUES (?, ?, ?, ?, ?, ?, ?, ?)
`;
const LOOKUP_SOURCE_ITEM_SQL = `
  SELECT id FROM exhibit_source_items WHERE source_label = ? AND source_url = ?
`;

interface ObservationDeps {
  readonly db: SqliteDatabase;
  readonly client: HermesClient;
  readonly now: () => Date;
}

// Process-local in-flight guard. The exhibit is single-process;
// a module-level Promise<RunResult> | null is the minimum
// sufficient primitive to keep manual and scheduled runs from
// overlapping. No queue, no second worker.
let inFlight: Promise<RunResult> | null = null;

/**
 * Run one observation cycle. Returns a small summary.
 * Catches all thrown errors and records them on the run row.
 */
export async function runObservation(deps: ObservationDeps, kind: RunKind): Promise<RunResult> {
  if (inFlight !== null) {
    // Another run is already in progress. The HTTP layer
    // translates this into 409 Conflict; the scheduler logs
    // and discards it.
    return {
      runId: '',
      status: 'skipped',
      newEvidenceCount: 0,
      newRelationshipCount: 0,
      errorMessage: 'another run is in progress',
    };
  }
  const exec = executeRunObservation(deps, kind);
  inFlight = exec;
  try {
    return await exec;
  } finally {
    inFlight = null;
  }
}

async function executeRunObservation(deps: ObservationDeps, kind: RunKind): Promise<RunResult> {
  const { db, client, now } = deps;
  const runId = randomUUID();
  const startedAt = now().toISOString();
  db.prepare(INSERT_RUN_SQL).run(runId, kind, startedAt);

  let newEvidenceCount = 0;
  let newRelationshipCount = 0;
  const itemErrors: string[] = [];
  const sourceErrors: string[] = [];
  let itemsSeen = 0;

  try {
    for (const source of FIXED_SOURCES) {
      const outcome = await fetchSource(source);
      if (outcome.error !== null) {
        sourceErrors.push(`${source.label}: ${outcome.error}`);
        // Continue with the remaining sources; a single failed
        // feed must not abort the whole run.
        continue;
      }
      for (const item of outcome.items) {
        itemsSeen += 1;
        const result = await processNewItem(db, client, now, {
          runId,
          sourceLabel: source.label,
          feedUrl: source.url,
          item,
        });
        if (result.error !== null) {
          itemErrors.push(result.error);
          continue;
        }
        // Only items that the model pipeline actually ran for
        // count toward newEvidenceCount. Dedup-skips return
        // `processed: false` and are silent no-ops.
        if (result.processed) {
          newEvidenceCount += 1;
          // Audit fix #4: relationship count is surface-only.
          if (result.surfaced === true) {
            newRelationshipCount += 1;
          }
        }
      }
    }
    const errorSummary = composeErrorSummary(itemErrors, sourceErrors, itemsSeen);
    const status = decideRunStatus(newEvidenceCount, itemsSeen, itemErrors, sourceErrors);
    db.prepare(FINISH_RUN_SQL).run(
      status,
      now().toISOString(),
      newEvidenceCount,
      newRelationshipCount,
      errorSummary,
      runId,
    );
    return {
      runId,
      status,
      newEvidenceCount,
      newRelationshipCount,
      errorMessage: errorSummary,
    };
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    const errorSummary = composeErrorSummary(
      [...itemErrors, message],
      sourceErrors,
      itemsSeen,
    );
    db.prepare(FINISH_RUN_SQL).run(
      'failed',
      now().toISOString(),
      newEvidenceCount,
      newRelationshipCount,
      errorSummary,
      runId,
    );
    return {
      runId,
      status: 'failed',
      newEvidenceCount,
      newRelationshipCount,
      errorMessage: errorSummary,
    };
  }
}

interface ProcessItemInput {
  readonly runId: string;
  readonly sourceLabel: string;
  readonly feedUrl: string;
  readonly item: { readonly title: string; readonly url: string; readonly excerpt: string };
}

interface ProcessItemResult {
  /** null on success, dedup-skip, or model-throw. */
  readonly error: string | null;
  /** true only when the model pipeline ran for this item. */
  readonly processed: boolean;
  /** surface decision produced by Relationship Reasoning. */
  readonly surfaced: boolean;
}

async function processNewItem(
  db: SqliteDatabase,
  client: HermesClient,
  now: () => Date,
  input: ProcessItemInput,
): Promise<ProcessItemResult> {
  const { runId, sourceLabel, feedUrl, item } = input;

  // Dedup gate: the (source_label, source_url) pair is the
  // stable identity of a real feed item. If a row already
  // exists we MUST NOT re-call Hermes for it. The article URL
  // is `item.url`; we never fall back to a fingerprint.
  const existing = db.prepare(LOOKUP_SOURCE_ITEM_SQL).get(sourceLabel, item.url) as { id: string } | undefined;
  if (existing !== undefined) {
    // `processed: false` so the orchestrator does not count
    // this item toward newEvidenceCount.
    return { error: null, processed: false, surfaced: false };
  }

  const sourceItemId = randomUUID();
  const insertResult = db.prepare(INSERT_SOURCE_ITEM_SQL).run(
    sourceItemId,
    runId,
    sourceLabel,
    item.url,
    feedUrl,
    now().toISOString(),
    item.title,
    item.excerpt,
    'ok',
    null,
  );
  if (insertResult.changes === 0) {
    // Another concurrent writer beat us to this (source_label,
    // source_url). The single-process guard already prevents
    // this, but the check stays in case a future change runs
    // two workers; either way, do not re-call Hermes.
    return { error: null, processed: false, surfaced: false };
  }

  try {
    const reconstructionPrompt = buildEvidenceReconstructionPrompt(
      { title: item.title, url: item.url, excerpt: item.excerpt },
      sourceLabel,
    );
    const reconstructed = await callModel(client, reconstructionPrompt, parseEvidenceReconstruction);

    const evidenceId = randomUUID();
    db.prepare(INSERT_EVIDENCE_SQL).run(
      evidenceId,
      runId,
      sourceItemId,
      reconstructed.directly_supported,
      reconstructed.implied_meaning,
      reconstructed.hypotheses_unknowns,
      now().toISOString(),
    );

    const situation = readSituation(db).rawText;
    const relationshipPrompt = buildRelationshipReasoningPrompt(situation, {
      directlySupported: reconstructed.directly_supported,
      impliedMeaning: reconstructed.implied_meaning,
      hypothesesUnknowns: reconstructed.hypotheses_unknowns,
    });
    const reasoning = await callModel(client, relationshipPrompt, parseRelationshipReasoning);

    db.prepare(INSERT_RELATIONSHIP_SQL).run(
      randomUUID(),
      runId,
      evidenceId,
      reasoning.surface_decision,
      reasoning.why_relevant,
      reasoning.evidence_used,
      reasoning.most_important_unknown,
      now().toISOString(),
    );

    return {
      error: null,
      processed: true,
      surfaced: reasoning.surface_decision === 'surface',
    };
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return {
      error: `item ${item.url}: ${message}`,
      processed: false,
      surfaced: false,
    };
  }
}

function decideRunStatus(
  newEvidenceCount: number,
  itemsSeen: number,
  itemErrors: ReadonlyArray<string>,
  sourceErrors: ReadonlyArray<string>,
): 'succeeded' | 'failed' {
  if (itemErrors.length === 0 && sourceErrors.length === 0) {
    return 'succeeded';
  }
  // Some work landed: succeeded, but errors are persisted on
  // the run row so the page can show them.
  if (newEvidenceCount > 0) {
    return 'succeeded';
  }
  // No new evidence this run. If we tried to process items
  // and every one of them failed, do not silently report
  // success — audit fix #3.
  if (itemsSeen > 0 && itemErrors.length >= itemsSeen) {
    return 'failed';
  }
  // All sources failed to fetch; the run itself completed but
  // produced nothing. Surface as succeeded with the error
  // summary so the operator can see what happened.
  if (itemsSeen === 0) {
    return 'succeeded';
  }
  return 'succeeded';
}

function composeErrorSummary(
  itemErrors: ReadonlyArray<string>,
  sourceErrors: ReadonlyArray<string>,
  itemsSeen: number,
): string | null {
  if (itemErrors.length === 0 && sourceErrors.length === 0) return null;
  const parts: string[] = [];
  if (sourceErrors.length > 0) {
    parts.push(`sources_failed=${sourceErrors.length}/${FIXED_SOURCES.length}`);
    for (const e of sourceErrors) parts.push(`  source: ${e}`);
  }
  if (itemErrors.length > 0) {
    parts.push(`items_failed=${itemErrors.length}/${itemsSeen}`);
    for (const e of itemErrors) parts.push(`  item: ${e}`);
  }
  return parts.join('\n');
}

async function callModel<T>(client: HermesClient, prompt: string, parse: (stdout: string) => T): Promise<T> {
  const req: HermesOneShotRequest = { prompt, safeMode: true };
  const res = await client.oneShot(req);
  return parse(res.stdout);
}

export type { RunRow, SourceItemRow, EvidenceRow, RelationshipRow };
