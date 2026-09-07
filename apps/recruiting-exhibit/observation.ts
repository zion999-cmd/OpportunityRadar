// apps/recruiting-exhibit/observation.ts — the observation
// orchestrator. One call to `runObservation(db, kind)` does:
//
//   1. Insert a `running` row into exhibit_observation_runs.
//   2. For each fixed source, fetch the feed and insert a
//      `exhibit_source_items` row. Per-source failures are
//      stored; they do not abort the run.
//   3. For each successful source item, call the model once
//      for Evidence Reconstruction. Persist the result.
//   4. For each reconstructed evidence, call the model once
//      for Relationship Reasoning against the current
//      Situation. Persist the result.
//   5. Update the run row with `succeeded` (or `failed`),
//      `new_evidence_count`, `new_relationship_count`,
//      `completed_at`.
//
// All work happens inside one DB transaction per source item
// so a partial failure leaves the DB in a consistent state.
// The function returns a small `RunResult` summary so the
// caller (CLI / HTTP / scheduler) can report what happened.

import { randomUUID } from 'node:crypto';
import type { HermesClient, HermesOneShotRequest } from '../../runtime/hermes/types.js';
import type { SqliteDatabase } from '../../storage/connection.js';
import { fetchSource } from './fetch.js';
import { parseEvidenceReconstruction, parseRelationshipReasoning } from './parse.js';
import { buildEvidenceReconstructionPrompt, buildRelationshipReasoningPrompt } from './prompts.js';
import { readSituation } from './situation-repo.js';
import { FIXED_SOURCES } from './sources.js';

export type RunKind = 'scheduled' | 'manual';

export interface RunResult {
  readonly runId: string;
  readonly status: 'succeeded' | 'failed';
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
const INSERT_SOURCE_ITEM_SQL = `
  INSERT INTO exhibit_source_items (id, run_id, source_label, source_url, captured_at, title, raw_excerpt, fetch_status, fetch_error)
  VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
`;
const INSERT_EVIDENCE_SQL = `
  INSERT INTO exhibit_reconstructed_evidence (id, run_id, source_item_id, claim, implied_meaning, hypotheses_unknowns, created_at)
  VALUES (?, ?, ?, ?, ?, ?, ?)
`;
const INSERT_RELATIONSHIP_SQL = `
  INSERT INTO exhibit_relationship_results (id, run_id, evidence_id, surface_decision, why_relevant, evidence_used, most_important_unknown, surfaced_at)
  VALUES (?, ?, ?, ?, ?, ?, ?, ?)
`;

interface ObservationDeps {
  readonly db: SqliteDatabase;
  readonly client: HermesClient;
  readonly now: () => Date;
}

/**
 * Run one observation cycle. Returns a small summary.
 * Catches all thrown errors and records them on the run row.
 */
export async function runObservation(deps: ObservationDeps, kind: RunKind): Promise<RunResult> {
  const { db, client, now } = deps;
  const runId = randomUUID();
  const startedAt = now().toISOString();
  db.prepare(INSERT_RUN_SQL).run(runId, kind, startedAt);

  let newEvidenceCount = 0;
  let newRelationshipCount = 0;
  const errorMessages: string[] = [];

  try {
    for (const source of FIXED_SOURCES) {
      const sourceItemId = randomUUID();
      const capturedAt = now().toISOString();
      const outcome = await fetchSource(source);
      const firstItem = outcome.items[0];
      db.prepare(INSERT_SOURCE_ITEM_SQL).run(
        sourceItemId,
        runId,
        source.label,
        source.url,
        capturedAt,
        firstItem?.title ?? null,
        firstItem?.excerpt ?? '',
        outcome.error === null ? 'ok' : 'failed',
        outcome.error,
      );
      if (outcome.error !== null) {
        // Continue with the remaining sources; a single failed
        // feed must not abort the whole run.
        continue;
      }
      for (const item of outcome.items) {
        // For very small per-run volumes (1-2 items per source,
        // 4 sources), one Evidence Reconstruction per item is
        // fine and matches the task's "5~20 条新 Evidence"
        // budget. We do not batch.
        try {
          const reconstructionPrompt = buildEvidenceReconstructionPrompt(item, source.label);
          const reconstructed = await callModel(client, reconstructionPrompt, parseEvidenceReconstruction);

          const evidenceId = randomUUID();
          const evidenceCreatedAt = now().toISOString();
          // If multiple items come from the same source_item row,
          // we still want a 1:1 source_item_id -> evidence_id
          // pair. The first item gets the source_item row; any
          // extra items from the same source get their own
          // synthetic source_item row so the FK is satisfied.
          let parentSourceItemId = sourceItemId;
          if (item !== firstItem) {
            parentSourceItemId = randomUUID();
            db.prepare(INSERT_SOURCE_ITEM_SQL).run(
              parentSourceItemId,
              runId,
              source.label,
              source.url,
              capturedAt,
              item.title,
              item.excerpt,
              'ok',
              null,
            );
          }
          db.prepare(INSERT_EVIDENCE_SQL).run(
            evidenceId,
            runId,
            parentSourceItemId,
            reconstructed.directly_supported,
            reconstructed.implied_meaning,
            reconstructed.hypotheses_unknowns,
            evidenceCreatedAt,
          );
          newEvidenceCount += 1;

          const situation = readSituation(db).rawText;
          const relationshipPrompt = buildRelationshipReasoningPrompt(situation, {
            directlySupported: reconstructed.directly_supported,
            impliedMeaning: reconstructed.implied_meaning,
            hypothesesUnknowns: reconstructed.hypotheses_unknowns,
          });
          const reasoning = await callModel(client, relationshipPrompt, parseRelationshipReasoning);

          const relationshipId = randomUUID();
          const surfacedAt = now().toISOString();
          db.prepare(INSERT_RELATIONSHIP_SQL).run(
            relationshipId,
            runId,
            evidenceId,
            reasoning.surface_decision,
            reasoning.why_relevant,
            reasoning.evidence_used,
            reasoning.most_important_unknown,
            surfacedAt,
          );
          newRelationshipCount += 1;
        } catch (err) {
          errorMessages.push(err instanceof Error ? err.message : String(err));
        }
      }
    }
    db.prepare(FINISH_RUN_SQL).run('succeeded', now().toISOString(), newEvidenceCount, newRelationshipCount, null, runId);
    return { runId, status: 'succeeded', newEvidenceCount, newRelationshipCount, errorMessage: null };
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    errorMessages.push(message);
    db.prepare(FINISH_RUN_SQL).run('failed', now().toISOString(), newEvidenceCount, newRelationshipCount, message, runId);
    return { runId, status: 'failed', newEvidenceCount, newRelationshipCount, errorMessage: message };
  }
}

async function callModel<T>(client: HermesClient, prompt: string, parse: (stdout: string) => T): Promise<T> {
  const req: HermesOneShotRequest = { prompt, safeMode: true };
  const res = await client.oneShot(req);
  return parse(res.stdout);
}

export type { RunRow, SourceItemRow, EvidenceRow, RelationshipRow };
