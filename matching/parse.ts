import { extractJsonObject } from '../runtime/hermes/parse.js';
import { relationJudgmentSchema, type RelationJudgment } from './relation-judgment.js';

// matching/parse.ts — turn Hermes's stdout into a typed
// RelationJudgment. Reuses the existing `extractJsonObject`
// helper (the last-balanced-brace JSON extractor that P0002
// already uses) so the POC does not duplicate transport
// parsing logic.
//
// This module does not import anything from `runtime/hermes/*`
// other than the pure `extractJsonObject` function. It is not
// the adapter — it is the schema validator. The adapter (the
// call to `client.oneShot`) lives in `run.ts`.

export function parseMatchingOutput(stdout: string): RelationJudgment {
  const raw = extractJsonObject(stdout);
  const parsed = relationJudgmentSchema.safeParse(raw);
  if (!parsed.success) {
    const first = parsed.error.issues[0];
    const path = first?.path.join('.') ?? '<root>';
    throw new Error(
      `parseMatchingOutput: failed schema validation at ${path}: ${first?.message ?? 'unknown'}`,
    );
  }
  return parsed.data;
}
