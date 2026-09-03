import { randomUUID } from 'node:crypto';
import { explorationResultSchema, type ExplorationResult } from '../contracts/exploration-result.js';
import type { EvidenceCandidate } from '../contracts/evidence-candidate.js';
import type { ExplorationGoal } from '../contracts/exploration-goal.js';
import { IngestPayloadSchema, type IngestPayload } from '../../evidence/contracts/ingest.js';
import type { SourceDocument } from '../../evidence/contracts/source-document.js';
import type { Evidence } from '../../evidence/contracts/evidence.js';
import type { IngestResult } from '../../evidence/repository/evidence-repository.js';
import type { SqliteDatabase } from '../../storage/connection.js';
import type { ExplorationRuntimeRouter } from '../../runtime/types.js';

// Exploration Bridge — ExplorationGoal → Radar → P0001. P0002 §3–§7.
//
// P0002 final architecture: Agent-neutral + Active Dispatch.
//
//   User intent
//     → ExplorationGoal (Radar constructs; Zod-validated)
//     → bridge.run(goal) — actively dispatches
//       → router.dispatch(goal)  — Runtime-neutral seam
//         → adapter.execute(goal)  — concrete Runtime
//           → ExplorationResult  — Zod-validated by the adapter
//       → goalId binding check
//       → per-candidate provenance gate (P0002 §6: no URL → reject)
//       → P0001 evidence-repository.ingest
//     → RunRecord (status, counts, errorMessage)
//
// Per ADR-016:
//   - The bridge depends on the Agent-neutral `ExplorationRuntimeRouter`
//     interface ONLY. The router is the single seam. Switching
//     runtimes = swapping the composition root; the bridge does not
//     change.
//   - The bridge does NOT know any concrete Runtime. The forbidden-
//     token architecture test enforces this; the bridge must
//     compile when every runtime-specific module is deleted.
//   - The bridge IS the place that owns business semantics:
//     provenance gating, goal/result binding, P0001 ingest, and
//     run lifecycle recording.
//
// Run status semantics:
//   failed     — boundary-level error (dispatch threw, Result did
//                not validate, or Result.goalId did not match the
//                Goal). No evidence was ingested.
//   succeeded  — Result validated and every candidate was
//                processed. Reject counts reflect candidates
//                refused at the boundary (no-URL provenance,
//                P0001 dedup, etc.); they do not change the
//                run's outcome class.
//   partial    — reserved; not emitted by the bridge today.

export type RunStatus = 'pending' | 'running' | 'succeeded' | 'failed' | 'partial';

export interface RunRecord {
  id: string;
  goal: ExplorationGoal;
  runtimeId: string;
  startedAt: string;
  completedAt: string | null;
  status: RunStatus;
  candidateCount: number;
  acceptedCount: number;
  rejectedCount: number;
  errorMessage: string | null;
}

export interface RunRecorder {
  startRun(id: string, goal: ExplorationGoal, runtimeId: string, startedAt: string): void;
  setCounts(id: string, candidateCount: number, acceptedCount: number, rejectedCount: number): void;
  setFinal(
    id: string,
    patch: Partial<Pick<RunRecord, 'completedAt' | 'status' | 'errorMessage'>>,
  ): void;
  getRun(id: string): RunRecord | undefined;
}

export class InMemoryRunRecorder implements RunRecorder {
  private readonly runs = new Map<string, RunRecord>();

  startRun(id: string, goal: ExplorationGoal, runtimeId: string, startedAt: string): void {
    this.runs.set(id, {
      id,
      goal,
      runtimeId,
      startedAt,
      completedAt: null,
      status: 'running',
      candidateCount: 0,
      acceptedCount: 0,
      rejectedCount: 0,
      errorMessage: null,
    });
  }

  setCounts(id: string, candidateCount: number, acceptedCount: number, rejectedCount: number): void {
    const r = this.runs.get(id);
    if (r) {
      r.candidateCount = candidateCount;
      r.acceptedCount = acceptedCount;
      r.rejectedCount = rejectedCount;
    }
  }

  setFinal(
    id: string,
    patch: Partial<Pick<RunRecord, 'completedAt' | 'status' | 'errorMessage'>>,
  ): void {
    const r = this.runs.get(id);
    if (r) Object.assign(r, patch);
  }

  getRun(id: string): RunRecord | undefined {
    return this.runs.get(id);
  }
}

export interface ExplorationBridgeConfig {
  db: SqliteDatabase;
  /**
   * The Agent-neutral Runtime seam. The bridge dispatches the
   * Goal through this router; the router holds the concrete
   * adapter. Required: there is no "no router" path.
   */
  router: ExplorationRuntimeRouter;
  /** Concrete Runtime id used for run-record tagging. Required. */
  runtimeId: string;
  evidenceIngest: (db: SqliteDatabase, payload: IngestPayload) => IngestResult;
  runRecorder: RunRecorder;
  runIdFactory?: () => string;
  evidenceIdFactory?: (index: number) => string;
  sourceIdFactory?: (index: number) => string;
  now?: () => Date;
}

export interface ExplorationRunOutcome {
  runId: string;
  status: RunStatus;
  runtimeId: string;
  accepted: number;
  rejected: number;
  errorMessage: string | null;
  result: ExplorationResult | null;
}

export interface ExplorationBridge {
  /**
   * Actively dispatch an ExplorationGoal through the Agent-neutral
   * runtime seam, validate the returned ExplorationResult, and
   * ingest accepted candidates into P0001. Exactly one RunRecord
   * is recorded per call.
   *
   * The bridge does not know which concrete Runtime produced the
   * Result. It only sees the typed `RouterInput` and the typed
   * Result; the adapter (outside this file) handled the
   * Runtime-specific translation.
   */
  run(goal: ExplorationGoal): Promise<ExplorationRunOutcome>;
}

function buildP0001IngestPayload(
  candidate: EvidenceCandidate,
  evidenceId: string,
  sourceId: string,
  observedAt: string,
): IngestPayload {
  // P0001 SourceDocument. The bridge generates the id; the URL is
  // the dedup key (P0001 normalizes it). The candidate's `market`
  // is the market the *fact* is about, which is what P0001 expects.
  const candidateSource = candidate.source;
  const source: SourceDocument = {
    id: sourceId,
    sourceType: candidateSource.sourceType as SourceDocument['sourceType'],
    publisher: candidateSource.publisher,
    title: candidateSource.title,
    canonicalUrl: candidateSource.url,
    publishedAt: candidateSource.publishedAt,
    accessedAt: candidateSource.accessedAt,
    language: candidateSource.language as SourceDocument['language'],
    market: candidate.market as SourceDocument['market'],
  };

  // P0001 Evidence. The bridge generates the id. The source is
  // "reported" by default because the Result came from an
  // external Agent; the repository may upgrade this on
  // corroboration with another run.
  const evidence: Evidence = {
    id: evidenceId,
    claim: candidate.claim,
    subject: candidate.subject,
    evidenceType: candidate.evidenceType as Evidence['evidenceType'],
    eventAt: candidate.eventAt,
    observedAt,
    market: candidate.market as Evidence['market'],
    confidence: 'reported',
    sourceRefs: [sourceId],
  };

  return { source, evidence: [evidence] };
}

export function createExplorationBridge(config: ExplorationBridgeConfig): ExplorationBridge {
  const {
    db,
    router,
    runtimeId,
    evidenceIngest,
    runRecorder,
    runIdFactory = (): string => randomUUID(),
    evidenceIdFactory = (): string => randomUUID(),
    sourceIdFactory = (): string => randomUUID(),
    now = (): Date => new Date(),
  } = config;

  async function run(goal: ExplorationGoal): Promise<ExplorationRunOutcome> {
    const runId = runIdFactory();
    const startedAt = now().toISOString();
    runRecorder.startRun(runId, goal, runtimeId, startedAt);

    const base: ExplorationRunOutcome = {
      runId,
      status: 'running',
      runtimeId,
      accepted: 0,
      rejected: 0,
      errorMessage: null,
      result: null,
    };

    // 1. Active dispatch through the Agent-neutral router. The
    //    router holds a concrete adapter; the bridge does not
    //    know which one. If the adapter throws (Runtime not
    //    installed, parse failed, etc.), the bridge records the
    //    run as `failed` and surfaces the error message.
    let raw: unknown;
    try {
      raw = await router.dispatch(goal);
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      const completedAt = now().toISOString();
      runRecorder.setFinal(runId, { status: 'failed', completedAt, errorMessage: message });
      return { ...base, status: 'failed', errorMessage: message };
    }

    // 2. Zod-validate the returned Result at the boundary. The
    //    adapter already produced a typed Result, but the bridge
    //    re-parses defensively so a future contract change fails
    //    loudly here rather than writing garbage.
    const reparsed = explorationResultSchema.safeParse(raw);
    if (!reparsed.success) {
      const issue = reparsed.error.issues[0];
      const path = issue?.path.join('.') ?? '<root>';
      const message = issue?.message ?? 'unknown';
      const errorMessage = `result: ${path}: ${message}`;
      const completedAt = now().toISOString();
      runRecorder.setFinal(runId, { status: 'failed', completedAt, errorMessage });
      return { ...base, status: 'failed', errorMessage };
    }
    const validated: ExplorationResult = reparsed.data;

    // 3. Verify the Result is bound to this Goal. An adapter that
    //    crosses wires (returns a Result for a different Goal) is
    //    a hard failure, not a partial success.
    if (validated.goalId !== goal.id) {
      const errorMessage = `result: goalId mismatch: got "${validated.goalId}", expected "${goal.id}"`;
      const completedAt = now().toISOString();
      runRecorder.setFinal(runId, { status: 'failed', completedAt, errorMessage });
      return { ...base, status: 'failed', errorMessage };
    }

    // 4. Per-candidate: provenance gate then P0001 ingest.
    const totalCandidates = validated.evidenceCandidates.length;
    let accepted = 0;
    let rejected = 0;
    const observedAt = validated.exploredAt;

    validated.evidenceCandidates.forEach((candidate, index) => {
      // Provenance gate (P0002 §6): no URL → no fact.
      if (!candidate.source.url || candidate.source.url.trim().length === 0) {
        rejected += 1;
        return;
      }
      try {
        const payload = buildP0001IngestPayload(
          candidate,
          evidenceIdFactory(index),
          sourceIdFactory(index),
          observedAt,
        );
        // Defensive re-parse so a future P0001 contract change
        // fails loudly instead of writing garbage.
        const parsedPayload = IngestPayloadSchema.parse(payload);
        evidenceIngest(db, parsedPayload);
        accepted += 1;
      } catch {
        // P0001 rejected (validation, dedup conflict, etc.) —
        // count the candidate as rejected. Do not fail the run.
        rejected += 1;
      }
    });

    // 5. Close out the run record.
    const completedAt = now().toISOString();
    const finalStatus: RunStatus = 'succeeded';
    runRecorder.setCounts(runId, totalCandidates, accepted, rejected);
    runRecorder.setFinal(runId, { status: finalStatus, completedAt, errorMessage: null });

    return {
      runId,
      status: finalStatus,
      runtimeId,
      accepted,
      rejected,
      errorMessage: null,
      result: validated,
    };
  }

  return { run };
}
