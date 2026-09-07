import { z } from 'zod';
import { discoveredCandidateRelationshipSchema } from '../parse.js';
import type { SessionTimeline, SessionTurn, FailedTurn } from './runtime.js';
import type { SessionState } from './state.js';

// matching/recruiting-poc/session/snapshot.ts —
// the resume-seam for the Product Spine session.
//
// The spine currently lives entirely in Node process memory.
// After a human review pause, the process is gone and the
// in-memory `SessionState` is lost. This module provides the
// minimum serialization needed to:
//
//   1. Take a `SessionTimeline` (after a turn, or at any point)
//      and serialize it to a versioned JSON file.
//   2. Parse a JSON file back into a typed `SessionSnapshot`.
//   3. Round-trip the state with no semantic drift: every
//      raw semantic string is preserved verbatim.
//
// What is NOT here (by spec, intentional):
//   - no Job / Profile / requirements / skills / tags schema;
//   - no extracted-answer classification;
//   - no intent fields, requirement fields;
//   - no DB, no ORM, no runtime framework.
// This is JSON-file persistence only, with raw semantic material
// stored verbatim.
//
// The `version: 1` literal is the contract. A future v2 will
// dispatch on `version` and keep v1 readable for old snapshots.

export const SNAPSHOT_VERSION = 1 as const;

// Zod schemas for the decision stored in a snapshot. Mirrors the
// discriminated union in session/parse.ts. The surface
// relationship shape is reused verbatim from
// `discoveredCandidateRelationshipSchema` so the persisted
// shape stays in lockstep with the live runtime shape.

const askDecisionSnapshotSchema = z.object({
  action: z.literal('ask'),
  question: z.string().min(1),
  whyItMatters: z.string().min(1),
});

const surfaceDecisionSnapshotSchema = z.object({
  action: z.literal('surface'),
  relationships: z.array(discoveredCandidateRelationshipSchema),
});

const decisionSnapshotSchema = z.discriminatedUnion('action', [
  askDecisionSnapshotSchema,
  surfaceDecisionSnapshotSchema,
]);

const sessionStateSnapshotSchema = z.object({
  rawSituation: z.string(),
  rawIntentEvidence: z.array(z.string()).readonly(),
  askCount: z.number().int().nonnegative(),
});

const sessionTurnSnapshotSchema = z.object({
  turnIndex: z.number().int().positive(),
  decision: decisionSnapshotSchema,
  stateAfter: sessionStateSnapshotSchema,
  rawOutput: z.string(),
  durationMs: z.number().nonnegative(),
  forced: z.boolean(),
});

// A failed turn is a hermes invocation whose response could
// not be parsed into a valid `RuntimeDecision`. The minimum
// persisted record is { rawOutput, error, forced, stateBefore }
// plus `turnIndex` for ordering with the successful turns.
// Persistence here is the whole point: the runtime must never
// erase the fact that the model was invoked.
const failedTurnSnapshotSchema = z.object({
  turnIndex: z.number().int().positive(),
  rawOutput: z.string(),
  error: z.string(),
  forced: z.boolean(),
  stateBefore: sessionStateSnapshotSchema,
});

export const sessionSnapshotSchema = z.object({
  version: z.literal(SNAPSHOT_VERSION),
  savedAtIso: z.string(),
  state: sessionStateSnapshotSchema,
  turns: z.array(sessionTurnSnapshotSchema).readonly(),
  questionsAsked: z.array(z.string()).readonly(),
  userAnswers: z.array(z.string()).readonly(),
  rawOutputs: z.array(z.string()).readonly(),
  failedTurns: z.array(failedTurnSnapshotSchema).readonly().default([]),
});

export type SessionSnapshot = z.infer<typeof sessionSnapshotSchema>;
export type SessionTurnSnapshot = z.infer<typeof sessionTurnSnapshotSchema>;
export type FailedTurnSnapshot = z.infer<typeof failedTurnSnapshotSchema>;

/**
 * Build a snapshot from a live `SessionTimeline`. Pure function.
 * Does not touch the filesystem. The caller decides where (and
 * whether) to write it.
 */
export function snapshotFromTimeline(timeline: SessionTimeline): SessionSnapshot {
  return {
    version: SNAPSHOT_VERSION,
    savedAtIso: new Date().toISOString(),
    state: timeline.finalState,
    turns: timeline.turns.map((t: SessionTurn) => ({
      turnIndex: t.turnIndex,
      decision: t.decision,
      stateAfter: t.stateAfter,
      rawOutput: t.rawOutput,
      durationMs: t.durationMs,
      forced: t.forced,
    })),
    questionsAsked: timeline.questionsAsked.slice(),
    userAnswers: timeline.userAnswers.slice(),
    rawOutputs: timeline.rawOutputs.slice(),
    failedTurns: timeline.failedTurns.map((f: FailedTurn) => ({
      turnIndex: f.turnIndex,
      rawOutput: f.rawOutput,
      error: f.error,
      forced: f.forced,
      stateBefore: f.stateBefore,
    })),
  };
}

/**
 * Parse a raw JSON string into a typed `SessionSnapshot`. Throws
 * a descriptive error if the version is unknown or the shape
 * does not validate.
 */
export function parseSnapshot(rawJson: string): SessionSnapshot {
  let json: unknown;
  try {
    json = JSON.parse(rawJson);
  } catch (e: unknown) {
    const message = e instanceof Error ? e.message : String(e);
    throw new Error(`parseSnapshot: JSON.parse failed: ${message}`);
  }
  const parsed = sessionSnapshotSchema.safeParse(json);
  if (!parsed.success) {
    const first = parsed.error.issues[0];
    const path = first?.path.join('.') ?? '<root>';
    throw new Error(
      `parseSnapshot: failed schema validation at ${path}: ${first?.message ?? 'unknown'}`,
    );
  }
  return parsed.data;
}

// Re-export the state type for convenience to consumers.
export type { SessionState };
