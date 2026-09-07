import { z } from 'zod';
import type { ExplorationResult } from '../../exploration/contracts/exploration-result.js';
import { explorationResultSchema } from '../../exploration/contracts/exploration-result.js';

// runtime/hermes/parse.ts — turn Hermes's stdout into a typed
// ExplorationResult. Hermes writes a human-readable summary and
// then a JSON object on the last line; this module extracts and
// validates that JSON, then binds it back to the originating Goal.
//
// Per ADR-016 ("Thin Adapter Boundary"): the adapter is the single
// place that knows "Hermes likes to wrap output in prose + a final
// JSON line". The Domain sees only the Zod-validated Result.

const rawCandidateSourceSchema = z.object({
  url: z.string(),
  publisher: z.string(),
  title: z.string(),
  publishedAt: z.string().nullable(),
  accessedAt: z.string(),
  sourceType: z.string(),
  language: z.string(),
});

const rawEvidenceCandidateSchema = z.object({
  claim: z.string(),
  subject: z.string(),
  evidenceType: z.string(),
  eventAt: z.string().nullable(),
  market: z.string(),
  source: rawCandidateSourceSchema,
});

const rawExplorationOutputSchema = z.object({
  summary: z.string(),
  sources: z.array(rawCandidateSourceSchema).default([]),
  evidenceCandidates: z.array(rawEvidenceCandidateSchema).default([]),
});

/**
 * Find the last balanced `{...}` block in `text`, ignoring
 * braces that appear inside JSON strings. Returns the substring
 * (inclusive of the outer braces) or `null` if no balanced
 * object is found.
 *
 * Walks right-to-left from the LAST `}` in the text, tracking
 * brace depth (and in-string state for `"` and `\` escapes).
 * The match is the slice from the first `{` that brings the
 * depth back to zero, up to and including the starting `}`.
 */
function findLastBalancedJsonObject(text: string): string | null {
  const lastClose = text.lastIndexOf('}');
  if (lastClose < 0) return null;
  let depth = 0;
  let inString = false;
  let escape = false;
  for (let i = lastClose; i >= 0; i -= 1) {
    const ch = text[i];
    if (escape) {
      escape = false;
      continue;
    }
    if (inString) {
      // Inside a JSON string: a `\` escapes the next char; a
      // `"` (unescaped) closes the string. Braces don't count.
      if (ch === '\\') {
        escape = true;
      } else if (ch === '"') {
        inString = false;
      }
      continue;
    }
    if (ch === '"') {
      inString = true;
    } else if (ch === '}') {
      depth += 1;
    } else if (ch === '{') {
      depth -= 1;
      if (depth === 0) {
        return text.slice(i, lastClose + 1);
      }
    }
  }
  return null;
}

/**
 * Find every position in `text` where a forward scan from the
 * first `{` reaches brace/bracket depth 0 (i.e. the end of a
 * balanced top-level JSON object). The first `{` to a depth-0
 * `}` is the natural end of the object; any subsequent chars
 * are candidate trailing junk.
 *
 * The scan is string-aware (`"` toggles inString, `\\` escapes
 * the next char) so braces inside JSON string values do not
 * count.
 */
function findTopLevelObjectEndPositions(text: string): number[] {
  const firstBrace = text.indexOf('{');
  if (firstBrace < 0) return [];
  const endPositions: number[] = [];
  let depth = 0;
  let inString = false;
  let escape = false;
  let everPositive = false;
  for (let i = firstBrace; i < text.length; i += 1) {
    const ch = text[i];
    if (escape) {
      escape = false;
      continue;
    }
    if (inString) {
      if (ch === '\\') {
        escape = true;
      } else if (ch === '"') {
        inString = false;
      }
      continue;
    }
    if (ch === '"') {
      inString = true;
    } else if (ch === '{' || ch === '[') {
      depth += 1;
      if (depth > 0) everPositive = true;
    } else if (ch === '}' || ch === ']') {
      depth -= 1;
      if (depth === 0 && everPositive) {
        endPositions.push(i);
      }
    }
  }
  return endPositions;
}

/**
 * Try to recover from a JSON parse error by removing the
 * character at the position the parser reported. The model
 * occasionally emits one or more stray `}` or `]` between
 * a property value and the closing `}` of its object (a
 * "double-close" failure). Removing the offending char and
 * re-parsing is a generic, schema-agnostic recovery that
 * does not hard-code any specific JSON shape.
 *
 * Strategy: try `JSON.parse(candidate)`. If it fails with a
 * SyntaxError that names a position, try removing the char
 * at that position and re-parse. Iterate up to
 * `MAX_REMOVALS` times. If the parse succeeds at any point,
 * return the value. If we exhaust the budget, return
 * `undefined` so the caller can fall through.
 *
 * The function is conservative in two ways:
 *   - It only removes ONE character per iteration (not a
 *     suffix), so a malformed JSON with many interleaved
 *     errors will surface after a few iterations rather than
 *     silently dropping valid content.
 *   - It only triggers when the original parse fails with a
 *     position-tagged SyntaxError. Any other error (e.g.
 *     `null` input, type errors) propagates immediately.
 */
const MAX_REMOVALS = 12;

function tryParseWithSingleCharRemoval(candidate: string): unknown {
  let current = candidate;
  for (let iter = 0; iter < MAX_REMOVALS; iter += 1) {
    try {
      return JSON.parse(current);
    } catch (err) {
      if (!(err instanceof SyntaxError)) {
        throw err;
      }
      const match = /position (\d+)/.exec(err.message);
      if (match === null) {
        return undefined;
      }
      const pos = Number(match[1]);
      if (!Number.isInteger(pos) || pos < 0 || pos >= current.length) {
        return undefined;
      }
      // Drop the char at the error position. We do not try
      // to "fix" the char (e.g. by changing `]` to `}`) —
      // a single-char removal preserves every other byte of
      // the original stdout and is the smallest possible
      // change. The next iteration re-parses from the
      // beginning and surfaces the next error position.
      current = current.slice(0, pos) + current.slice(pos + 1);
    }
  }
  return undefined;
}

/**
 * Extract the last JSON object from Hermes's stdout.
 *
 * Strategy (in order):
 *   1. Cheap single-line scan: walk back from the last line;
 *      if a line starts with `{` and ends with `}` and parses,
 *      return it. Handles the most common case.
 *   2. Multi-line balanced search: find the last balanced
 *      `{...}` block in the entire stdout. Handles pretty-
 *      printed JSON that spans multiple lines and JSON
 *      surrounded by markdown code fences.
 *   3. Trailing-junk forward scan: when the model emits a
 *      balanced JSON object followed by extra closing braces /
 *      brackets (or any trailing characters), the balanced
 *      search above returns a slice that includes the extra
 *      closers and JSON.parse fails. The forward scan
 *      records every position where the depth first returns
 *      to 0 — the first such position is the actual end of
 *      the JSON, and any chars past it are junk. We try
 *      JSON.parse at each such position; the first that
 *      parses wins.
 *   4. Surgical single-char removal: when the JSON itself
 *      contains one or more stray closers (e.g. an extra
 *      `]` between a property value and the closing `}` of
 *      its object), the previous strategies' slices
 *      parse-fail mid-JSON. Both the right-to-left
 *      balanced slice (Strategy 2) and each forward-scan
 *      slice (Strategy 3) are retried under iterative
 *      single-char removal at the error position.
 *   5. If all four fail, throw — the adapter treats this as
 *      a Hermes failure and the bridge records the run as
 *      `failed`.
 */
export function extractJsonObject(stdout: string): unknown {
  // Strategy 1: single-line scan, last line first.
  const lines = stdout.split('\n');
  for (let i = lines.length - 1; i >= 0; i -= 1) {
    const line = (lines[i] ?? '').trim();
    if (!line.startsWith('{')) continue;
    if (!line.endsWith('}')) continue;
    try {
      return JSON.parse(line);
    } catch {
      // Even a single-line candidate that looks like JSON may
      // not parse (e.g. a trailing period or a backtick). Try
      // one in-place repair: take the substring from the
      // line's last `{` to its last `}`. This handles the
      // common case of trailing junk on a flat-JSON line; for
      // a line with nested objects the substring is the
      // innermost balanced block, which JSON.parse will
      // reject and we will continue to the next line.
      // Surgical char removal is NOT applied here — when
      // the substring is an inner object, iterative
      // removal would "succeed" by parsing the inner
      // object (not the outer JSON the caller expects).
      const firstBrace = line.lastIndexOf('{');
      const lastBrace = line.lastIndexOf('}');
      if (firstBrace < 0 || lastBrace <= firstBrace) continue;
      const candidate = line.slice(firstBrace, lastBrace + 1);
      try {
        return JSON.parse(candidate);
      } catch {
        continue;
      }
    }
  }

  // Strategy 2: multi-line balanced search. The right-to-left
  // walk tracks only `{` and `}` (not `[` / `]`), so it
  // returns a slice that includes the full JSON even when
  // the model emitted extra `]` characters. Try the slice
  // verbatim, then under surgical char removal (Strategy 4)
  // — but only when the slice is actually JSON-like (i.e.
  // contains a string-quote). A bare `{ word }` fragment in
  // prose has balanced braces but is not a JSON object;
  // surgical removal on it would happily strip the word
  // out and "succeed" with an empty `{}`, masking the
  // real "no JSON in this stdout" condition.
  const balanced = findLastBalancedJsonObject(stdout);
  if (balanced !== null) {
    try {
      return JSON.parse(balanced);
    } catch {
      if (balanced.includes('"')) {
        const repaired = tryParseWithSingleCharRemoval(balanced);
        if (repaired !== undefined) {
          return repaired;
        }
      }
      // Fall through to Strategy 3.
    }
  }

  // Strategy 3: forward scan from the first `{`, recording
  // every position where depth returns to 0. Try JSON.parse
  // at each such position; the first that parses wins. This
  // is the recovery path for trailing-junk cases that
  // Strategy 2's right-to-left walk cannot distinguish.
  // Each candidate is tried verbatim only — the forward-
  // scan slices may be incomplete (when stray `]` chars
  // bring depth to 0 prematurely mid-JSON), so surgical
  // removal on an incomplete slice would risk returning
  // a sub-object.
  const firstBrace = stdout.indexOf('{');
  if (firstBrace >= 0) {
    const endPositions = findTopLevelObjectEndPositions(stdout);
    for (const pos of endPositions) {
      const candidate = stdout.slice(firstBrace, pos + 1);
      try {
        return JSON.parse(candidate);
      } catch {
        // Try the next end position.
      }
    }
  }

  throw new Error(
    `parseHermesOutput: no parseable JSON object found in stdout (${stdout.length} chars)`,
  );
}

/**
 * Coerce Hermes's loose datetime strings into Zod-valid
 * ISO 8601 datetimes, or reject them.
 *
 * Three outcomes, in order:
 *   1. The value is already a strict ISO 8601 datetime
 *      (Zod's `z.string().datetime()` accepts this shape —
 *      `YYYY-MM-DDTHH:MM:SS[.sss](Z|±HH:MM)`). Pass through
 *      unchanged.
 *   2. The value is an ISO 8601 date-only string
 *      (`YYYY-MM-DD`). This carries real semantic meaning
 *      (the provenance day) and is promoted to midnight UTC.
 *   3. The value is anything else (unparseable, a localized
 *      string like "today", a bare year, etc.). Reject —
 *      the adapter MUST NEVER manufacture a provenance
 *      timestamp by substituting `clock()`. A rejected
 *      accessedAt throws, the bridge catches the throw, and
 *      the run is recorded as `failed` with the error
 *      surfaced.
 */
function coerceIsoDatetime(value: string): string {
  // Strict ISO 8601 datetime: 2026-09-03T10:00:00.000Z or
  // 2026-09-03T10:00:00+08:00 (or any combination thereof).
  // The regex is intentionally tight: a year alone, a date
  // alone, or a partial-time string must not match.
  const strictIso =
    /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(\.\d+)?(Z|[+-]\d{2}:\d{2})$/;
  if (strictIso.test(value)) {
    return value;
  }
  // Date-only ISO 8601: 2026-09-03. Promoted to midnight UTC.
  const dateOnly = /^\d{4}-\d{2}-\d{2}$/;
  if (dateOnly.test(value)) {
    return `${value}T00:00:00.000Z`;
  }
  // Everything else is rejected. We deliberately do NOT
  // fall through to `new Date(value)` — it is too permissive
  // (it accepts "Jan 5 2020", "2026", etc.) and we want to
  // refuse any value we did not explicitly whitelist.
  throw new Error(
    `parseHermesOutput: Hermes emitted unparseable accessedAt "${value}"; cannot manufacture provenance`,
  );
}

/**
 * Coerce a nullable datetime string (`publishedAt`,
 * `eventAt`) to a strict ISO 8601 datetime or `null`.
 *
 * These fields are nullable in the P0001 contract: a Source
 * can be "accessed" (a real URL) even when the publisher did
 * not stamp a publication date, and an Evidence event can be
 * undated (e.g. "the company has been growing for several
 * years"). For these fields:
 *
 *   - Strict ISO 8601 datetime: pass through unchanged.
 *   - Date-only ISO 8601 (`YYYY-MM-DD`): promote to midnight
 *     UTC. Same semantic promotion as `accessedAt`.
 *   - `null` / `undefined`: pass through as `null`.
 *   - Anything else: collapse to `null`. The run's value is
 *     the candidate fact, not the date — we will NOT fail the
 *     whole run over a single bad publication date. We also
 *     will NOT manufacture a date (a `publishedAt: null`
 *     downstream is a *known unknown*; a `publishedAt:
 *     <run-clock>` would be a fabricated fact and the
 *     analyst's first clue that something is wrong is gone).
 *
 * The contrast with `coerceIsoDatetime` (which throws) is
 * intentional: `accessedAt` is the *provenance anchor* — we
 * know we hit the URL — so an unparseable value is fatal.
 * `publishedAt` and `eventAt` are *semantic facts about the
 * source content*; an unknown value is acceptable because
 * the schema explicitly allows it.
 */
function coerceNullableIsoDatetime(value: string | null | undefined): string | null {
  if (value === null || value === undefined || value === '') {
    return null;
  }
  const strictIso =
    /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(\.\d+)?(Z|[+-]\d{2}:\d{2})$/;
  if (strictIso.test(value)) {
    return value;
  }
  const dateOnly = /^\d{4}-\d{2}-\d{2}$/;
  if (dateOnly.test(value)) {
    return `${value}T00:00:00.000Z`;
  }
  // Unparseable: collapse to null. We DO NOT throw here —
  // the bridge will write the Evidence with `publishedAt: null`
  // and the analyst can fill it in later (or drop the fact if
  // it is too undated to be useful).
  return null;
}

/**
 * Parse Hermes stdout into a Zod-validated ExplorationResult.
 *
 * The output schema mirrors the contract we asked Hermes to
 * produce, but the field types are permissive (e.g. `eventAt` may
 * be null) so a single missing field does not collapse the whole
 * run. Each candidate's `market` is normalized to one of
 * CN / US / GLOBAL / OTHER; anything else is mapped to OTHER.
 * Each `accessedAt` is coerced to a strict ISO 8601 datetime; if
 * Hermes emitted an unparseable date, the run's clock is used.
 */
export function parseHermesOutput(
  stdout: string,
  goalId: string,
  now: () => Date,
): ExplorationResult {
  const raw = extractJsonObject(stdout);
  const parsed = rawExplorationOutputSchema.safeParse(raw);
  if (!parsed.success) {
    const first = parsed.error.issues[0];
    const path = first?.path.join('.') ?? '<root>';
    throw new Error(
      `parseHermesOutput: Hermes output failed schema validation at ${path}: ${first?.message ?? 'unknown'}`,
    );
  }
  const data = parsed.data;

  // Normalize the candidate market into the P0001 enum. Hermes
  // may emit "USA" or "us" or any variant; we collapse to one
  // of the four canonical values or "OTHER" as a last resort.
  const normalizeMarket = (m: string): 'CN' | 'US' | 'GLOBAL' | 'OTHER' => {
    const upper = m.trim().toUpperCase();
    if (upper === 'CN' || upper === 'CHINA' || upper === 'CN-CN') return 'CN';
    if (upper === 'US' || upper === 'USA' || upper === 'UNITED STATES' || upper === 'U.S.') return 'US';
    if (upper === 'GLOBAL' || upper === 'WW' || upper === 'WORLD' || upper === 'WORLDWIDE') return 'GLOBAL';
    return 'OTHER';
  };

  // Normalize Hermes's sourceType vocabulary into the P0001
  // SourceDocument enum. Hermes uses a different vocabulary
  // (`blog`, `case_study`, `press_release`, `filing`, `filing_sec`,
  // `social`, `paper`, `database`) that does not match the
  // P0001 sourceType enum. Per ADR-016, the adapter absorbs
  // Hermes's vocabulary; the Domain contract stays frozen.
  // Unknown values fall through to "other".
  type SourceType = ExplorationResult['sources'][number]['sourceType'];
  const normalizeSourceType = (raw: string): SourceType => {
    const lower = raw.trim().toLowerCase();
    if (lower === 'news') return 'news';
    if (lower === 'company_announcement' || lower === 'company announcement') return 'company_announcement';
    if (lower === 'government') return 'government';
    if (
      lower === 'financial_report' ||
      lower === 'financial report' ||
      lower === 'filing' ||
      lower === 'filing_sec' ||
      lower === 'sec_filing'
    ) {
      return 'financial_report';
    }
    if (lower === 'product_page' || lower === 'product page' || lower === 'product launch') return 'product_page';
    if (lower === 'repository' || lower === 'repo') return 'repository';
    if (lower === 'marketplace') return 'marketplace';
    if (
      lower === 'research' ||
      lower === 'paper' ||
      lower === 'case_study' ||
      lower === 'database' ||
      lower === 'blog' ||
      lower === 'press_release' ||
      lower === 'social'
    ) {
      // Blogs, press releases, social posts, and research are
      // not first-class in the P0001 sourceType enum. They
      // carry claim weight (some are first-party from the
      // subject) but the Domain does not yet have a stable
      // category for them; collapse to "other". A future
      // Proposal can promote these to first-class if the
      // Ground Truth surfaces a stable taxonomy.
      return 'other';
    }
    return 'other';
  };

  const candidates = data.evidenceCandidates.map((c) => ({
    claim: c.claim,
    subject: c.subject,
    evidenceType: c.evidenceType as ExplorationResult['evidenceCandidates'][number]['evidenceType'],
    eventAt: coerceNullableIsoDatetime(c.eventAt),
    market: normalizeMarket(c.market),
    source: {
      url: c.source.url,
      publisher: c.source.publisher,
      title: c.source.title,
      publishedAt: coerceNullableIsoDatetime(c.source.publishedAt),
      accessedAt: coerceIsoDatetime(c.source.accessedAt),
      sourceType: normalizeSourceType(c.source.sourceType),
      language: c.source.language as ExplorationResult['evidenceCandidates'][number]['source']['language'],
    },
  }));

  const sources = data.sources.map((s) => ({
    url: s.url,
    publisher: s.publisher,
    title: s.title,
    publishedAt: coerceNullableIsoDatetime(s.publishedAt),
    accessedAt: coerceIsoDatetime(s.accessedAt),
    sourceType: normalizeSourceType(s.sourceType),
    language: s.language as ExplorationResult['sources'][number]['language'],
  }));

  const result = {
    goalId,
    summary: data.summary,
    sources,
    evidenceCandidates: candidates,
    exploredAt: now().toISOString(),
  };
  // Final defensive validation: the radar domain contract.
  return explorationResultSchema.parse(result);
}
