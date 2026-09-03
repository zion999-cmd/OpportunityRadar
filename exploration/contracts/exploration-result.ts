import { z } from 'zod';
import { evidenceCandidateSchema, candidateSourceSchema } from './evidence-candidate.js';

// ExplorationResult — what an external Agent capability returns
// to Radar, after Zod validation. P0002 §3 / ADR-015.
//
// The Result binds back to the Goal, carries a human-readable
// summary, the dedup'd set of sources the Agent discovered, and
// the candidate evidence list. The summary is for human review
// only — it MUST NOT be persisted into the Evidence Store.
//
// Per ADR-015 this contract is Agent-neutral: it does not name
// any Agent Runtime, transport, session, credential, model, or
// tool. Whoever produced this Result — whether a long-lived
// session, a per-call process, or a queue — is outside Radar's
// concern.

export const explorationResultSchema = z.object({
  goalId: z.string().min(1),
  summary: z.string(),
  sources: z.array(candidateSourceSchema),
  evidenceCandidates: z.array(evidenceCandidateSchema),
  exploredAt: z.string().datetime(),
});

export type ExplorationResult = z.infer<typeof explorationResultSchema>;
