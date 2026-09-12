// Unit tests for the POC-SURFACE-01 frontend read-side view
// model (web/src/view-models/semantic-card.ts). The module is
// pure TypeScript (no React / DOM) so it runs under the root
// Vitest setup unchanged.

import { describe, expect, it } from 'vitest';
import {
  buildMagazine,
  DEMO_GRID,
  DEMO_HERO,
  findCard,
  mapInboxEntry,
  MIN_GRID_CARDS,
  sizeAtPosition,
  type SemanticCard,
} from '../../../../apps/recruiting-exhibit/web/src/view-models/semantic-card.js';
import type { InboxEntry } from '../../../../apps/recruiting-exhibit/views.js';
import { FIXED_SOURCES } from '../../../../apps/recruiting-exhibit/sources.js';

function makeEntry(overrides: Partial<InboxEntry> = {}): InboxEntry {
  const base: InboxEntry = {
    relationshipId: 'rel-1',
    evidenceId: 'ev-1',
    sourceLabel: FIXED_SOURCES[0]?.label ?? 'github-engineering',
    sourceUrl: 'https://example.com/post/1',
    feedUrl: 'https://example.com/feed.xml',
    sourceTitle: 'Real source title',
    rawExcerpt: 'A real raw excerpt from the source item.',
    claim: '企业正在重新定义 AI 落地人才的要求',
    impliedMeaning: '业务理解加 AI 应用成为新的能力组合',
    whyRelevant: '与你的企业软件落地经验直接相关',
    evidenceUsed: 'JD 与工程博客证据各一条',
    mostImportantUnknown: '尚不清楚是否形成稳定职位类别',
    surfacedAt: '2026-09-10T08:00:00.000Z',
  };
  return { ...base, ...overrides };
}

describe('mapInboxEntry', () => {
  it('maps a surfaced relationship onto one semantic card without fabricating fields', () => {
    const card = mapInboxEntry(makeEntry(), 0);

    expect(card.id).toBe('rel-1');
    // The title is the recovered meaning (stage-2 interpretation)…
    expect(card.title).toBe('业务理解加 AI 应用成为新的能力组合');
    // …while the reconstructed claim supports it as the short summary.
    expect(card.summary).toBe('企业正在重新定义 AI 落地人才的要求');
    expect(card.impliedMeaning).toBe('业务理解加 AI 应用成为新的能力组合');
    expect(card.whyRelated).toContain('企业软件');
    expect(card.unknown).toBe('尚不清楚是否形成稳定职位类别');
    expect(card.isDemo).toBe(false);
    expect(card.evidenceCount).toBe(1);
  });

  it('exposes one real source preview with clickable URLs and excerpt', () => {
    const card = mapInboxEntry(makeEntry(), 1);

    expect(card.sources).toHaveLength(1);
    const source = card.sources[0]!;
    expect(source.url).toBe('https://example.com/post/1');
    expect(source.feedUrl).toBe('https://example.com/feed.xml');
    expect(source.title).toBe('Real source title');
    expect(source.excerpt).toContain('real raw excerpt');
  });

  it('falls back to the claim as source title when the feed item has no title', () => {
    const card = mapInboxEntry(makeEntry({ sourceTitle: '' }), 0);
    expect(card.sources[0]?.title).toBe(makeEntry().claim);
  });

  it('falls back to the claim as title when no implied meaning was reconstructed', () => {
    const card = mapInboxEntry(makeEntry({ impliedMeaning: '' }), 0);
    expect(card.title).toBe(card.summary);
    expect(card.title).toBe('企业正在重新定义 AI 落地人才的要求');
  });

  it('picks a deterministic local image variant and the prescribed size cycle', () => {
    const first = mapInboxEntry(makeEntry({ relationshipId: 'stable-id' }), 0);
    const second = mapInboxEntry(makeEntry({ relationshipId: 'stable-id' }), 0);
    expect(first.imageUrl).toBe(second.imageUrl);
    expect(first.imageUrl).toMatch(/^\/images\/meaning-[1-6]\.svg$/);

    expect(sizeAtPosition(0)).toBe('large');
    expect(sizeAtPosition(2)).toBe('small');
    expect(sizeAtPosition(8)).toBe('large');
    expect(first.size).toBe('large');
  });
});

describe('buildMagazine', () => {
  it('falls back to the fully-demo magazine when the inbox is empty', () => {
    const magazine = buildMagazine([]);

    expect(magazine.usingDemo).toBe(true);
    expect(magazine.demoFillFrom).toBeNull();
    expect(magazine.hero).toEqual(DEMO_HERO);
    expect(magazine.grid).toHaveLength(MIN_GRID_CARDS);
    expect(magazine.grid.every((card) => card.isDemo)).toBe(true);
    expect(magazine.grid[0]?.size).toBe('large');
  });

  it('promotes the newest real relationship to hero and marks only the tail as demo fill', () => {
    const magazine = buildMagazine([makeEntry()]);

    expect(magazine.usingDemo).toBe(false);
    expect(magazine.demoFillFrom).toBe(0);
    expect(magazine.hero.id).toBe('rel-1');
    expect(magazine.hero.isDemo).toBe(false);
    expect(magazine.hero.imageUrl).toBe('/images/hero.svg');
    expect(magazine.grid).toHaveLength(MIN_GRID_CARDS);
    expect(magazine.grid.every((card) => card.isDemo)).toBe(true);
  });

  it('stops filling with demos once enough real cards exist', () => {
    const entries: InboxEntry[] = Array.from({ length: 7 }, (_, i) =>
      makeEntry({ relationshipId: `rel-${i + 1}`, claim: `意义 ${i + 1}` }),
    );

    const magazine = buildMagazine(entries);

    expect(magazine.demoFillFrom).toBeNull();
    expect(magazine.hero.id).toBe('rel-1');
    expect(magazine.grid).toHaveLength(6);
    expect(magazine.grid.every((card) => !card.isDemo)).toBe(true);
  });
});

describe('demo dataset honesty', () => {
  it('never gives demo evidence a clickable URL (trust layer cannot be faked)', () => {
    const allDemo: SemanticCard[] = [DEMO_HERO, ...DEMO_GRID];
    for (const card of allDemo) {
      expect(card.isDemo).toBe(true);
      for (const source of card.sources) {
        expect(source.url).toBe('');
        expect(source.feedUrl).toBe('');
      }
      expect(card.unknown.length).toBeGreaterThan(10);
    }
  });
});

describe('findCard', () => {
  it('finds hero and grid cards by id and returns undefined for unknown ids', () => {
    const magazine = buildMagazine([makeEntry()]);

    expect(findCard(magazine, 'rel-1')?.id).toBe('rel-1');
    expect(findCard(magazine, magazine.grid[0]!.id)?.id).toBe(magazine.grid[0]!.id);
    expect(findCard(magazine, 'does-not-exist')).toBeUndefined();
  });
});
