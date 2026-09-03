import { describe, it, expect } from 'vitest';
import { extractJsonObject, parseHermesOutput } from '../../../../runtime/hermes/parse.js';

// Unit tests for the Hermes output parser. Hermes writes a
// human-readable summary and a JSON object on the last line; the
// parser extracts the JSON, validates it against the explorer
// schema, and binds it back to the originating goal.

const NOW = (): Date => new Date('2026-09-03T02:00:00.000Z');

describe('extractJsonObject', () => {
  it('finds the JSON on the last line when preceded by prose', () => {
    const stdout = [
      'Here is what I found.',
      '',
      'Wonderful raised a Series C. Multiple sources confirm.',
      '',
      '{"summary":"Wonderful raised a Series C","sources":[],"evidenceCandidates":[]}',
    ].join('\n');
    const out = extractJsonObject(stdout);
    expect(out).toEqual({ summary: 'Wonderful raised a Series C', sources: [], evidenceCandidates: [] });
  });

  it('finds the JSON when it is the only line', () => {
    const stdout = '{"summary":"x","sources":[],"evidenceCandidates":[]}';
    const out = extractJsonObject(stdout);
    expect(out).toMatchObject({ summary: 'x' });
  });

  it('finds pretty-printed JSON that spans multiple lines', () => {
    // Hermes often pretty-prints its JSON output across multiple
    // lines. The parser must walk the multi-line block, not just
    // the last line, to find the balanced object.
    const stdout = `Unable to answer. Returning empty arrays as instructed.

{"summary": "Unable to answer. Web search tools are unavailable.",
 "sources": [],
 "evidenceCandidates": []}`;
    const out = extractJsonObject(stdout);
    expect(out).toMatchObject({ sources: [], evidenceCandidates: [] });
  });

  it('finds the JSON when wrapped in markdown code fences', () => {
    const stdout = [
      'Here is the JSON you asked for:',
      '```json',
      '{"summary":"x","sources":[],"evidenceCandidates":[]}',
      '```',
    ].join('\n');
    const out = extractJsonObject(stdout);
    expect(out).toMatchObject({ summary: 'x' });
  });

  it('handles nested objects in pretty-printed JSON', () => {
    const stdout = [
      'Prose line.',
      '',
      '{',
      '  "summary": "x",',
      '  "sources": [],',
      '  "evidenceCandidates": []',
      '}',
    ].join('\n');
    const out = extractJsonObject(stdout);
    expect(out).toMatchObject({ summary: 'x' });
  });

  it('throws when no parseable JSON is present', () => {
    expect(() => extractJsonObject('just a summary, no JSON')).toThrowError(/no parseable JSON/);
  });

  it('throws on a JSON-looking but syntactically broken line', () => {
    expect(() => extractJsonObject('{"summary": broken')).toThrowError(/no parseable JSON/);
  });
});

describe('parseHermesOutput', () => {
  it('parses a full valid Hermes output into an ExplorationResult bound to the goal', () => {
    const stdout = [
      'Human-readable summary text',
      '',
      JSON.stringify({
        summary: 'Wonderful raised a Series C; multiple sources confirm.',
        sources: [
          {
            url: 'https://www.reuters.com/article/a',
            publisher: 'Reuters',
            title: 'Wonderful Series C',
            publishedAt: '2026-09-02T10:00:00.000Z',
            accessedAt: '2026-09-03T01:00:00.000Z',
            sourceType: 'news',
            language: 'en',
          },
        ],
        evidenceCandidates: [
          {
            claim: 'Wonderful raised USD 550M in a Series C.',
            subject: 'Wonderful',
            evidenceType: 'funding',
            eventAt: '2026-08-30T00:00:00.000Z',
            market: 'us',
            source: {
              url: 'https://www.reuters.com/article/a',
              publisher: 'Reuters',
              title: 'Wonderful Series C',
              publishedAt: '2026-09-02T10:00:00.000Z',
              accessedAt: '2026-09-03T01:00:00.000Z',
              sourceType: 'news',
              language: 'en',
            },
          },
        ],
      }),
    ].join('\n');

    const result = parseHermesOutput(stdout, 'goal-1', NOW);
    expect(result.goalId).toBe('goal-1');
    expect(result.summary).toBe('Wonderful raised a Series C; multiple sources confirm.');
    expect(result.sources).toHaveLength(1);
    expect(result.evidenceCandidates).toHaveLength(1);
    // Market normalization: "us" → "US"
    expect(result.evidenceCandidates[0]?.market).toBe('US');
    // exploredAt comes from the caller's clock, not from Hermes
    expect(result.exploredAt).toBe('2026-09-03T02:00:00.000Z');
  });

  it('handles a "found nothing" result with empty arrays', () => {
    const stdout = JSON.stringify({ summary: 'no signal', sources: [], evidenceCandidates: [] });
    const result = parseHermesOutput(stdout, 'goal-1', NOW);
    expect(result.evidenceCandidates).toEqual([]);
    expect(result.sources).toEqual([]);
    expect(result.summary).toBe('no signal');
  });

  it('normalizes unknown market strings to OTHER', () => {
    const stdout = JSON.stringify({
      summary: 's',
      sources: [],
      evidenceCandidates: [
        {
          claim: 'c',
          subject: 'subj',
          evidenceType: 'funding',
          eventAt: '2026-08-30T00:00:00.000Z',
          market: 'WONDERLAND',
          source: {
            url: 'https://example.com/x',
            publisher: 'p',
            title: 't',
            publishedAt: null,
            accessedAt: '2026-09-03T01:00:00.000Z',
            sourceType: 'news',
            language: 'en',
          },
        },
      ],
    });
    const result = parseHermesOutput(stdout, 'goal-1', NOW);
    expect(result.evidenceCandidates[0]?.market).toBe('OTHER');
  });

  it('throws when the JSON shape fails schema validation', () => {
    // Missing required `summary`
    const stdout = JSON.stringify({ sources: [], evidenceCandidates: [] });
    expect(() => parseHermesOutput(stdout, 'goal-1', NOW)).toThrowError(/summary/);
  });

  it('throws when the output is not parseable JSON at all', () => {
    expect(() => parseHermesOutput('just text', 'goal-1', NOW)).toThrowError(/no parseable JSON/);
  });

  it('normalizes a date-only accessedAt to midnight UTC', () => {
    // Hermes occasionally emits "2026-09-03" (date only). The
    // Zod contract requires a strict ISO 8601 datetime. The
    // date-only form carries real semantic meaning (the
    // provenance day) so it is promoted to midnight UTC, not
    // rejected and not replaced with the run clock.
    const stdout = JSON.stringify({
      summary: 's',
      sources: [
        {
          url: 'https://example.com/a',
          publisher: 'p',
          title: 't',
          publishedAt: null,
          accessedAt: '2026-09-03',
          sourceType: 'news',
          language: 'en',
        },
      ],
      evidenceCandidates: [],
    });
    const result = parseHermesOutput(stdout, 'goal-1', NOW);
    expect(result.sources[0]?.accessedAt).toBe('2026-09-03T00:00:00.000Z');
  });

  it('passes a strict ISO 8601 accessedAt through unchanged', () => {
    const stdout = JSON.stringify({
      summary: 's',
      sources: [
        {
          url: 'https://example.com/a',
          publisher: 'p',
          title: 't',
          publishedAt: null,
          accessedAt: '2026-09-03T10:00:00.000Z',
          sourceType: 'news',
          language: 'en',
        },
      ],
      evidenceCandidates: [],
    });
    const result = parseHermesOutput(stdout, 'goal-1', NOW);
    expect(result.sources[0]?.accessedAt).toBe('2026-09-03T10:00:00.000Z');
  });

  it('rejects an unparseable accessedAt value rather than fabricating one', () => {
    // Per the adapter's contract, an unparseable accessedAt
    // is a hard error: the adapter MUST NOT manufacture a
    // provenance timestamp by substituting the run clock. The
    // bridge catches the throw and records the run as
    // `failed` with the error surfaced.
    const stdout = JSON.stringify({
      summary: 's',
      sources: [
        {
          url: 'https://example.com/a',
          publisher: 'p',
          title: 't',
          publishedAt: null,
          accessedAt: 'totally not a date',
          sourceType: 'news',
          language: 'en',
        },
      ],
      evidenceCandidates: [],
    });
    expect(() => parseHermesOutput(stdout, 'goal-1', NOW)).toThrowError(
      /unparseable accessedAt "totally not a date".*cannot manufacture provenance/,
    );
  });

  it('rejects a bare-year accessedAt (no date-only promotion for incomplete dates)', () => {
    // "2026" is not the date-only ISO 8601 form (which requires
    // YYYY-MM-DD). It must be rejected, not silently coerced.
    const stdout = JSON.stringify({
      summary: 's',
      sources: [
        {
          url: 'https://example.com/a',
          publisher: 'p',
          title: 't',
          publishedAt: null,
          accessedAt: '2026',
          sourceType: 'news',
          language: 'en',
        },
      ],
      evidenceCandidates: [],
    });
    expect(() => parseHermesOutput(stdout, 'goal-1', NOW)).toThrowError(
      /unparseable accessedAt "2026"/,
    );
  });

  it('normalizes Hermes sourceType vocabulary into the P0001 SourceDocument enum', () => {
    // Hermes uses a richer sourceType vocabulary (blog,
    // press_release, case_study, paper, social, etc.) than
    // the P0001 SourceDocument enum (9 fixed values). Per
    // ADR-016, the adapter absorbs the extra vocabulary; the
    // Domain contract stays frozen. Unknown / out-of-enum
    // values fall through to "other".
    const stdout = JSON.stringify({
      summary: 's',
      sources: [
        {
          url: 'https://example.com/news',
          publisher: 'p',
          title: 'news src',
          publishedAt: null,
          accessedAt: '2026-09-03T01:00:00.000Z',
          sourceType: 'news',
          language: 'en',
        },
        {
          url: 'https://example.com/blog',
          publisher: 'p',
          title: 'blog src',
          publishedAt: null,
          accessedAt: '2026-09-03T01:00:00.000Z',
          sourceType: 'blog',
          language: 'en',
        },
        {
          url: 'https://example.com/pr',
          publisher: 'p',
          title: 'pr src',
          publishedAt: null,
          accessedAt: '2026-09-03T01:00:00.000Z',
          sourceType: 'press_release',
          language: 'en',
        },
        {
          url: 'https://example.com/case',
          publisher: 'p',
          title: 'case src',
          publishedAt: null,
          accessedAt: '2026-09-03T01:00:00.000Z',
          sourceType: 'case_study',
          language: 'en',
        },
        {
          url: 'https://example.com/filing',
          publisher: 'p',
          title: 'filing src',
          publishedAt: null,
          accessedAt: '2026-09-03T01:00:00.000Z',
          sourceType: 'filing',
          language: 'en',
        },
        {
          url: 'https://example.com/bogus',
          publisher: 'p',
          title: 'bogus src',
          publishedAt: null,
          accessedAt: '2026-09-03T01:00:00.000Z',
          sourceType: 'definitely_not_an_enum_value',
          language: 'en',
        },
      ],
      evidenceCandidates: [],
    });
    const result = parseHermesOutput(stdout, 'goal-1', NOW);
    // news maps through
    expect(result.sources[0]?.sourceType).toBe('news');
    // blog → other (no first-class equivalent in P0001)
    expect(result.sources[1]?.sourceType).toBe('other');
    // press_release → other
    expect(result.sources[2]?.sourceType).toBe('other');
    // case_study → other
    expect(result.sources[3]?.sourceType).toBe('other');
    // filing → financial_report
    expect(result.sources[4]?.sourceType).toBe('financial_report');
    // unknown → other (defensive default)
    expect(result.sources[5]?.sourceType).toBe('other');
  });

  it('passes a strict ISO 8601 publishedAt through unchanged', () => {
    // publishedAt is nullable in the contract. A valid ISO
    // 8601 datetime must pass through unchanged on both
    // sources and the candidate's source.
    const stdout = JSON.stringify({
      summary: 's',
      sources: [
        {
          url: 'https://example.com/a',
          publisher: 'p',
          title: 't',
          publishedAt: '2026-09-02T10:00:00.000Z',
          accessedAt: '2026-09-03T01:00:00.000Z',
          sourceType: 'news',
          language: 'en',
        },
      ],
      evidenceCandidates: [
        {
          claim: 'c',
          subject: 'subj',
          evidenceType: 'funding',
          eventAt: '2026-08-30T00:00:00.000Z',
          market: 'us',
          source: {
            url: 'https://example.com/a',
            publisher: 'p',
            title: 't',
            publishedAt: '2026-09-02T10:00:00.000Z',
            accessedAt: '2026-09-03T01:00:00.000Z',
            sourceType: 'news',
            language: 'en',
          },
        },
      ],
    });
    const result = parseHermesOutput(stdout, 'goal-1', NOW);
    expect(result.sources[0]?.publishedAt).toBe('2026-09-02T10:00:00.000Z');
    expect(result.evidenceCandidates[0]?.source.publishedAt).toBe('2026-09-02T10:00:00.000Z');
    expect(result.evidenceCandidates[0]?.eventAt).toBe('2026-08-30T00:00:00.000Z');
  });

  it('preserves a null publishedAt and eventAt through the pipeline', () => {
    // The contract allows null for both fields. The parser
    // must not coerce a present null into a synthesized
    // value.
    const stdout = JSON.stringify({
      summary: 's',
      sources: [
        {
          url: 'https://example.com/a',
          publisher: 'p',
          title: 't',
          publishedAt: null,
          accessedAt: '2026-09-03T01:00:00.000Z',
          sourceType: 'news',
          language: 'en',
        },
      ],
      evidenceCandidates: [
        {
          claim: 'c',
          subject: 'subj',
          evidenceType: 'funding',
          eventAt: null,
          market: 'us',
          source: {
            url: 'https://example.com/a',
            publisher: 'p',
            title: 't',
            publishedAt: null,
            accessedAt: '2026-09-03T01:00:00.000Z',
            sourceType: 'news',
            language: 'en',
          },
        },
      ],
    });
    const result = parseHermesOutput(stdout, 'goal-1', NOW);
    expect(result.sources[0]?.publishedAt).toBeNull();
    expect(result.evidenceCandidates[0]?.source.publishedAt).toBeNull();
    expect(result.evidenceCandidates[0]?.eventAt).toBeNull();
  });

  it('normalizes a date-only publishedAt and eventAt to midnight UTC', () => {
    // Date-only ISO 8601 carries real semantic meaning (the
    // publication / event day) and must be promoted to
    // midnight UTC, same as the date-only accessedAt case.
    const stdout = JSON.stringify({
      summary: 's',
      sources: [
        {
          url: 'https://example.com/a',
          publisher: 'p',
          title: 't',
          publishedAt: '2026-09-02',
          accessedAt: '2026-09-03T01:00:00.000Z',
          sourceType: 'news',
          language: 'en',
        },
      ],
      evidenceCandidates: [
        {
          claim: 'c',
          subject: 'subj',
          evidenceType: 'funding',
          eventAt: '2026-08-30',
          market: 'us',
          source: {
            url: 'https://example.com/a',
            publisher: 'p',
            title: 't',
            publishedAt: '2026-09-02',
            accessedAt: '2026-09-03T01:00:00.000Z',
            sourceType: 'news',
            language: 'en',
          },
        },
      ],
    });
    const result = parseHermesOutput(stdout, 'goal-1', NOW);
    expect(result.sources[0]?.publishedAt).toBe('2026-09-02T00:00:00.000Z');
    expect(result.evidenceCandidates[0]?.source.publishedAt).toBe('2026-09-02T00:00:00.000Z');
    expect(result.evidenceCandidates[0]?.eventAt).toBe('2026-08-30T00:00:00.000Z');
  });

  it('collapses an unparseable publishedAt and eventAt to null rather than failing the run', () => {
    // Contrast with the accessedAt case: publishedAt and
    // eventAt are nullable in the contract, so an
    // unparseable value is collapsed to null instead of
    // throwing. The run's value is the candidate fact, not
    // the date — we will not fail the whole run over a
    // single bad publication date, and we will not
    // manufacture a date to hide the unknown.
    const stdout = JSON.stringify({
      summary: 's',
      sources: [
        {
          url: 'https://example.com/a',
          publisher: 'p',
          title: 't',
          publishedAt: 'last Tuesday',
          accessedAt: '2026-09-03T01:00:00.000Z',
          sourceType: 'news',
          language: 'en',
        },
      ],
      evidenceCandidates: [
        {
          claim: 'c',
          subject: 'subj',
          evidenceType: 'funding',
          eventAt: 'a few months ago',
          market: 'us',
          source: {
            url: 'https://example.com/a',
            publisher: 'p',
            title: 't',
            publishedAt: 'around 2026',
            accessedAt: '2026-09-03T01:00:00.000Z',
            sourceType: 'news',
            language: 'en',
          },
        },
      ],
    });
    const result = parseHermesOutput(stdout, 'goal-1', NOW);
    // Sources-level publishedAt collapsed to null
    expect(result.sources[0]?.publishedAt).toBeNull();
    // Candidate eventAt collapsed to null
    expect(result.evidenceCandidates[0]?.eventAt).toBeNull();
    // Candidate source.publishedAt collapsed to null
    expect(result.evidenceCandidates[0]?.source.publishedAt).toBeNull();
    // The accessedAt (which is non-nullable and provenance-
    // critical) is still strict ISO 8601 — the unparseable
    // siblings did not contaminate it.
    expect(result.sources[0]?.accessedAt).toBe('2026-09-03T01:00:00.000Z');
    expect(result.evidenceCandidates[0]?.source.accessedAt).toBe('2026-09-03T01:00:00.000Z');
  });
});
