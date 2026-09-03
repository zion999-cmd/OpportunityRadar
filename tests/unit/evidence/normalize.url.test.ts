import { describe, it, expect } from 'vitest';
import { normalizeUrl } from '../../../evidence/normalization/url.js';

// Unit tests for the URL normalizer. Per P0001 §Source Dedup, the
// goal is *conservative* dedup: a SourceDocument is uniquely keyed
// on its canonicalUrl. We do NOT do complex URL canonicalization
// or follow redirects — we only normalise the surface form so
// trivially-different URLs collapse to the same key.

describe('normalizeUrl', () => {
  it('returns the same string for a well-formed URL', () => {
    const input = 'https://www.reuters.com/article/wonderful-series-c-2026';
    expect(normalizeUrl(input)).toBe(input);
  });

  it('removes the URL fragment', () => {
    expect(
      normalizeUrl('https://www.reuters.com/article/wonderful#section-2'),
    ).toBe('https://www.reuters.com/article/wonderful');
  });

  it('removes a trailing slash on the path', () => {
    expect(normalizeUrl('https://example.com/path/')).toBe(
      'https://example.com/path',
    );
  });

  it('preserves the root path slash', () => {
    // Per RFC 3986 the root path "/" carries meaning; do not strip it.
    expect(normalizeUrl('https://example.com/')).toBe('https://example.com/');
  });

  it('lowercases the protocol', () => {
    expect(normalizeUrl('HTTPS://example.com/path')).toBe(
      'https://example.com/path',
    );
  });

  it('lowercases the host', () => {
    expect(normalizeUrl('https://Example.COM/Path')).toBe(
      'https://example.com/Path',
    );
  });

  it('trims surrounding whitespace', () => {
    expect(normalizeUrl('  https://example.com/path  ')).toBe(
      'https://example.com/path',
    );
  });

  it('is stable across multiple invocations', () => {
    const input = 'https://Example.com/Path/?q=1#frag';
    const first = normalizeUrl(input);
    const second = normalizeUrl(first);
    const third = normalizeUrl(second);
    expect(second).toBe(first);
    expect(third).toBe(first);
  });

  it('produces the same canonical form for trivially different inputs', () => {
    const a = 'https://www.reuters.com/article/wonderful';
    const b = 'HTTPS://www.reuters.com/article/wonderful/';
    const c = 'https://www.reuters.com/article/wonderful#top';
    const d = '  https://www.reuters.com/article/wonderful  ';
    const normalized = 'https://www.reuters.com/article/wonderful';
    expect(normalizeUrl(a)).toBe(normalized);
    expect(normalizeUrl(b)).toBe(normalized);
    expect(normalizeUrl(c)).toBe(normalized);
    expect(normalizeUrl(d)).toBe(normalized);
  });

  it('throws on a syntactically invalid URL', () => {
    expect(() => normalizeUrl('not a url')).toThrow();
  });
});
