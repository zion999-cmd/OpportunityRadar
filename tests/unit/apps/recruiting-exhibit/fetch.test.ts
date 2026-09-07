import { describe, expect, it } from 'vitest';
import { extractItems, stripTags } from '../../../../apps/recruiting-exhibit/fetch.js';
import { FIXED_SOURCES } from '../../../../apps/recruiting-exhibit/sources.js';

describe('recruiting-exhibit feed extractor', () => {
  it('strips HTML tags and decodes common XML entities', () => {
    // stripTags collapses tags to single spaces; consumers can
    // .trim() if they need a tight string.
    expect(stripTags('<p>Hello <b>world</b> &amp; &quot;friends&quot;</p>').trim()).toBe('Hello world & "friends"');
  });

  it('extracts items from a minimal RSS feed', () => {
    const xml = `<?xml version="1.0" encoding="UTF-8"?>
      <rss><channel>
        <title>Test</title>
        <item>
          <title>Postmortem A</title>
          <link>https://example.com/a</link>
          <description>First postmortem excerpt</description>
        </item>
        <item>
          <title>Postmortem B</title>
          <link>https://example.com/b</link>
          <description>Second excerpt</description>
        </item>
      </channel></rss>`;
    const items = extractItems(xml, 5);
    expect(items).toHaveLength(2);
    expect(items[0]?.title).toBe('Postmortem A');
    expect(items[0]?.url).toBe('https://example.com/a');
    expect(items[0]?.excerpt).toContain('First postmortem excerpt');
  });

  it('extracts items from a minimal Atom feed', () => {
    const xml = `<?xml version="1.0" encoding="UTF-8"?>
      <feed>
        <entry>
          <title>Engineering retro</title>
          <link href="https://example.com/x"/>
          <summary>Retro excerpt</summary>
        </entry>
      </feed>`;
    const items = extractItems(xml, 5);
    expect(items).toHaveLength(1);
    expect(items[0]?.title).toBe('Engineering retro');
    expect(items[0]?.url).toBe('https://example.com/x');
  });

  it('respects the limit parameter', () => {
    const xml = '<rss><channel>'
      + '<item><title>a</title><link>https://x/1</link><description>1</description></item>'
      + '<item><title>b</title><link>https://x/2</link><description>2</description></item>'
      + '<item><title>c</title><link>https://x/3</link><description>3</description></item>'
      + '</channel></rss>';
    expect(extractItems(xml, 2)).toHaveLength(2);
  });

  it('FIXED_SOURCES contains 3-5 distinct engineering sources', () => {
    expect(FIXED_SOURCES.length).toBeGreaterThanOrEqual(3);
    expect(FIXED_SOURCES.length).toBeLessThanOrEqual(5);
    const ids = new Set(FIXED_SOURCES.map((s) => s.id));
    expect(ids.size).toBe(FIXED_SOURCES.length);
    for (const s of FIXED_SOURCES) {
      expect(s.url).toMatch(/^https:\/\//);
    }
  });
});
