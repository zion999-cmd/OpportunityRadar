// apps/recruiting-exhibit/situation-repo.ts — single-row CRUD
// for the user's current Situation text.
//
// The exhibit stores the Situation as raw natural-language text.
// Per task.md, no skills / requirements / tags / filters / job
// fields are extracted; the raw string is the only persisted form.

import { randomUUID } from 'node:crypto';
import type { SqliteDatabase } from '../../storage/connection.js';

// POC-SURFACE-01 demo Situation. This is a demo default for the
// single active Action Lens ("求职 / 应聘") — the user can still
// replace it with their own raw text; nothing parses it.
export const DEFAULT_SITUATION =
  '我做过多年企业软件和后端系统，参与过复杂业务系统落地，现在希望寻找下一阶段职业机会。我并不确定自己的经历在 AI 时代应该如何被理解。';

// The pre-Surface demo Situation was an English hiring-team /
// Kafka brief, which does not fit the magazine's job-seeker
// framing. If that exact demo string is still the only stored
// Situation, it is replaced by the new default once. User-edited
// text (anything different) is never touched.
const LEGACY_DEMO_SITUATION = `We are a 50-person B2B SaaS team. We need a senior backend engineer who can own a high-throughput event-streaming pipeline (Kafka), reason about distributed-systems trade-offs in writing, and ship production code with minimal supervision. We prefer evidence-grounded reasoning over keyword matching; the bar is a candidate who can independently decompose a real production incident, write a precise postmortem, and explain the trade-offs they did NOT take.`;

export interface SituationRow {
  readonly rawText: string;
  readonly updatedAt: string;
}

const GET_SITUATION_SQL = `SELECT raw_text, updated_at FROM exhibit_situation WHERE id = 1`;
const UPSERT_SITUATION_SQL = `
  INSERT INTO exhibit_situation (id, raw_text, updated_at) VALUES (1, ?, ?)
  ON CONFLICT(id) DO UPDATE SET raw_text = excluded.raw_text, updated_at = excluded.updated_at
`;

export function readSituation(db: SqliteDatabase): SituationRow {
  const row = db.prepare(GET_SITUATION_SQL).get() as { raw_text: string; updated_at: string } | undefined;
  if (row === undefined) {
    seedDefault(db);
    const seeded = db.prepare(GET_SITUATION_SQL).get() as { raw_text: string; updated_at: string };
    return { rawText: seeded.raw_text, updatedAt: seeded.updated_at };
  }
  // One-time replacement of the pre-Surface English demo brief.
  if (row.raw_text.trim() === LEGACY_DEMO_SITUATION.trim()) {
    const now = new Date().toISOString();
    db.prepare(UPSERT_SITUATION_SQL).run(DEFAULT_SITUATION, now);
    return { rawText: DEFAULT_SITUATION, updatedAt: now };
  }
  return { rawText: row.raw_text, updatedAt: row.updated_at };
}

export function writeSituation(db: SqliteDatabase, rawText: string): SituationRow {
  const trimmed = rawText.trim();
  if (trimmed.length === 0) {
    throw new Error('situation must not be empty');
  }
  const now = new Date().toISOString();
  db.prepare(UPSERT_SITUATION_SQL).run(trimmed, now);
  return { rawText: trimmed, updatedAt: now };
}

function seedDefault(db: SqliteDatabase): void {
  db.prepare(UPSERT_SITUATION_SQL).run(DEFAULT_SITUATION, new Date().toISOString());
}

// Random id helper kept here so the repo file owns its
// id-generation contract.
export function newId(): string {
  return randomUUID();
}
