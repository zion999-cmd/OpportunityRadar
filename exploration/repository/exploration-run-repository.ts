import { explorationGoalSchema } from '../contracts/exploration-goal.js';
import type { SqliteDatabase } from '../../storage/connection.js';
import type {
  RunStatus,
  RunRecord,
  RunRecorder,
} from '../bridge/exploration-bridge.js';

// exploration-run-repository — SQLite-backed RunRecorder for the
// exploration bridge. Implements the RunRecorder interface from
// `exploration/bridge/exploration-bridge.ts` so the bridge can
// stay decoupled from storage details.
//
// P0002 §13.4 — schema fields are exactly:
//   id, goal, runtimeId, startedAt, completedAt, status,
//   candidateCount, acceptedCount, rejectedCount, errorMessage
// No telemetry columns are added (no model / maxTurns / tokens
// / session-id / runtime-internal trace). The `runtimeId` is the
// only Runtime-derived field — it is the *public* identity
// advertised by the adapter (`RuntimeAdapter.runtimeId`), not any
// Runtime-internal session or transport state. The goal is stored
// as JSON; round-trip is Zod-validated to keep the contract intact.

interface ExplorationRunRow {
  id: string;
  goal_json: string;
  runtime_id: string;
  started_at: string;
  completed_at: string | null;
  status: string;
  candidate_count: number;
  accepted_count: number;
  rejected_count: number;
  error_message: string | null;
}

function rowToRunRecord(row: ExplorationRunRow): RunRecord {
  const parsed = JSON.parse(row.goal_json) as unknown;
  const goal = explorationGoalSchema.parse(parsed);
  return {
    id: row.id,
    goal,
    runtimeId: row.runtime_id,
    startedAt: row.started_at,
    completedAt: row.completed_at,
    status: row.status as RunStatus,
    candidateCount: row.candidate_count,
    acceptedCount: row.accepted_count,
    rejectedCount: row.rejected_count,
    errorMessage: row.error_message,
  };
}

const SQL = {
  insert: `INSERT INTO exploration_runs
    (id, goal_json, runtime_id, started_at, status, candidate_count, accepted_count, rejected_count)
    VALUES (?, ?, ?, ?, 'running', 0, 0, 0)`,
  setCounts: `UPDATE exploration_runs
    SET candidate_count = ?, accepted_count = ?, rejected_count = ?
    WHERE id = ?`,
  setFinal: `UPDATE exploration_runs
    SET completed_at = ?, status = ?, error_message = ?
    WHERE id = ?`,
  getById: `SELECT * FROM exploration_runs WHERE id = ?`,
  list: `SELECT * FROM exploration_runs ORDER BY started_at DESC LIMIT ?`,
};

export function createSqliteRunRecorder(db: SqliteDatabase): RunRecorder {
  return {
    startRun(id, goal, runtimeId, startedAt) {
      db.prepare(SQL.insert).run(id, JSON.stringify(goal), runtimeId, startedAt);
    },
    setCounts(id, candidateCount, acceptedCount, rejectedCount) {
      db.prepare(SQL.setCounts).run(candidateCount, acceptedCount, rejectedCount, id);
    },
    setFinal(id, patch) {
      const completedAt = patch.completedAt ?? new Date().toISOString();
      const status: RunStatus = patch.status ?? 'failed';
      const errorMessage = patch.errorMessage ?? null;
      db.prepare(SQL.setFinal).run(completedAt, status, errorMessage, id);
    },
    getRun(id) {
      const row = db.prepare(SQL.getById).get(id) as ExplorationRunRow | undefined;
      return row ? rowToRunRecord(row) : undefined;
    },
  };
}

export function listRuns(db: SqliteDatabase, limit: number = 50): RunRecord[] {
  const rows = db.prepare(SQL.list).all(limit) as ExplorationRunRow[];
  return rows.map(rowToRunRecord);
}
