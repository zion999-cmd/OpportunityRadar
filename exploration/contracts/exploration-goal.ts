import { z } from 'zod';
import { marketSchema } from '../../evidence/contracts/source-document.js';
import { evidenceTypeSchema } from '../../evidence/contracts/evidence.js';

// ExplorationGoal — the smallest business object Radar hands to
// an external Agent capability. P0002 §1 / ADR-015.
//
// The Goal carries the question, the market context, an optional
// time window, and optional evidence-type hints. It does NOT
// carry any Agent-Runtime-specific concept: no model name, no
// tool list, no transport hint, no session id, no credential.
// Whoever wraps the external Agent (decided at deployment time,
// outside Radar) is responsible for translating the Goal into
// whatever shape that Agent needs.
//
// Reuses the P0001 enums (market, evidenceType) verbatim — Radar
// does not invent a parallel taxonomy for goals.

export const explorationGoalSchema = z.object({
  id: z.string().min(1),
  question: z.string().min(1).max(2000),
  market: marketSchema,
  timeWindow: z.string().min(1).max(200).optional(),
  evidenceInterests: z.array(evidenceTypeSchema).optional(),
  createdAt: z.string().datetime(),
});

export type ExplorationGoal = z.infer<typeof explorationGoalSchema>;
