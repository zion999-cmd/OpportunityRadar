import { describe, it, expect } from 'vitest';
import {
  SourceDocumentSchema,
  sourceTypeSchema,
  languageSchema,
  marketSchema,
} from '../../../evidence/contracts/source-document.js';

// Contract tests for SourceDocument. The contract is the boundary between
// any external input (CLI payload, fixture file, future ingest) and the
// Radar's evidence layer. Per CLAUDE.md §6, every external boundary must
// be Zod-validated. The tests below pin the contract's behaviour.

describe('SourceDocument contract', () => {
  describe('sourceType enum', () => {
    it('accepts every documented sourceType', () => {
      const allowed = [
        'news',
        'company_announcement',
        'government',
        'financial_report',
        'product_page',
        'repository',
        'marketplace',
        'research',
        'other',
      ] as const;
      for (const value of allowed) {
        const result = sourceTypeSchema.safeParse(value);
        expect(result.success).toBe(true);
      }
    });

    it('rejects an unknown sourceType', () => {
      const result = sourceTypeSchema.safeParse('blog_personal');
      expect(result.success).toBe(false);
    });
  });

  describe('language enum', () => {
    it('accepts the documented languages', () => {
      expect(languageSchema.safeParse('en').success).toBe(true);
      expect(languageSchema.safeParse('zh').success).toBe(true);
    });

    it('rejects an unsupported language', () => {
      const result = languageSchema.safeParse('ja');
      expect(result.success).toBe(false);
    });
  });

  describe('market enum', () => {
    it('accepts the four documented market values', () => {
      expect(marketSchema.safeParse('CN').success).toBe(true);
      expect(marketSchema.safeParse('US').success).toBe(true);
      expect(marketSchema.safeParse('GLOBAL').success).toBe(true);
      expect(marketSchema.safeParse('OTHER').success).toBe(true);
    });

    it('rejects an unknown market', () => {
      const result = marketSchema.safeParse('EU');
      expect(result.success).toBe(false);
    });
  });

  describe('full SourceDocument payload', () => {
    const validSource = {
      id: 'src-reuters-wonderful-20260902',
      sourceType: 'news' as const,
      publisher: 'Reuters',
      title: 'Wonderful raises USD 550M Series C',
      canonicalUrl: 'https://www.reuters.com/article/wonderful-series-c-2026',
      publishedAt: '2026-09-02T10:00:00.000Z',
      accessedAt: '2026-09-03T01:23:45.000Z',
      language: 'en' as const,
      market: 'US' as const,
    };

    it('accepts a complete, well-formed SourceDocument', () => {
      const result = SourceDocumentSchema.safeParse(validSource);
      expect(result.success).toBe(true);
    });

    it('rejects a non-URL canonicalUrl', () => {
      const result = SourceDocumentSchema.safeParse({
        ...validSource,
        canonicalUrl: 'not a url',
      });
      expect(result.success).toBe(false);
    });

    it('rejects an invalid market value', () => {
      const result = SourceDocumentSchema.safeParse({
        ...validSource,
        market: 'EU',
      });
      expect(result.success).toBe(false);
    });

    it('rejects a malformed publishedAt timestamp', () => {
      const result = SourceDocumentSchema.safeParse({
        ...validSource,
        publishedAt: '2026-13-40',
      });
      expect(result.success).toBe(false);
    });

    it('accepts null publishedAt (unknown publication time)', () => {
      const result = SourceDocumentSchema.safeParse({
        ...validSource,
        publishedAt: null,
      });
      expect(result.success).toBe(true);
    });

    it('rejects an empty publisher', () => {
      const result = SourceDocumentSchema.safeParse({
        ...validSource,
        publisher: '',
      });
      expect(result.success).toBe(false);
    });

    it('rejects an empty title', () => {
      const result = SourceDocumentSchema.safeParse({
        ...validSource,
        title: '',
      });
      expect(result.success).toBe(false);
    });

    it('rejects an empty id', () => {
      const result = SourceDocumentSchema.safeParse({
        ...validSource,
        id: '',
      });
      expect(result.success).toBe(false);
    });
  });
});
