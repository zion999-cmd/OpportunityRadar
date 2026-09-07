// apps/recruiting-exhibit/situation-repo.ts — single-row CRUD
// for the user's current Situation text.
//
// The exhibit stores the Situation as raw natural-language text.
// Per task.md, no skills / requirements / tags / filters / job
// fields are extracted; the raw string is the only persisted form.

import { randomUUID } from 'node:crypto';
import type { SqliteDatabase } from '../../storage/connection.js';

export const DEFAULT_SITUATION = `We are a 50-person B2B SaaS team. We need a senior backend engineer who can own a high-throughput event-streaming pipeline (Kafka), reason about distributed-systems trade-offs in writing, and ship production code with minimal supervision. We prefer evidence-grounded reasoning over keyword matching; the bar is a candidate who can independently decompose a real production incident, write a precise postmortem, and explain the trade-offs they did NOT take.`;

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
