// apps/recruiting-exhibit/fetch.ts — fetch a single fixed
// public source over HTTP and pull out the latest items from
// the RSS / Atom XML.
//
// The fetcher is intentionally tiny:
//   1. HTTP GET with a 5-second timeout, plain `fetch` (Node 22+).
//   2. Parse the response body as XML using a hand-rolled,
//      permissive extractor (we do NOT add a dependency).
//   3. Pull out the latest N <item> (RSS) or <entry> (Atom)
//      records; for each, return the title, the URL, and a
//      short plain-text excerpt (description / summary).
//   4. Errors never throw — they return an empty array. The
//      observation run records the per-source failure separately
//      and continues with the remaining sources.
//
// The extractor is permissive on purpose: real-world feed XML
// varies in namespace, encoding, and the field it uses for
// the body. We look for the most common shapes and stop
// gracefully.

import type { FixedSource } from './sources.js';

export interface FetchedItem {
  readonly title: string;
  readonly url: string;
  readonly excerpt: string;
}

export interface FetchOutcome {
  readonly items: ReadonlyArray<FetchedItem>;
  readonly error: string | null;
}

const FETCH_TIMEOUT_MS = 5_000;

/**
 * Fetch the source's RSS / Atom feed and extract the latest N
 * items. Returns either a list of items or an error message —
 * never throws.
 */
export async function fetchSource(source: FixedSource): Promise<FetchOutcome> {
  try {
    const res = await fetch(source.url, {
      headers: { 'user-agent': 'OpportunityRadar-recruiting-exhibit/0.1 (+local)' },
      signal: AbortSignal.timeout(FETCH_TIMEOUT_MS),
    });
    if (!res.ok) {
      return { items: [], error: `HTTP ${res.status}` };
    }
    const xml = await res.text();
    const items = extractItems(xml, source.maxItems);
    return { items, error: items.length === 0 ? 'no items parsed from feed' : null };
  } catch (err) {
    return { items: [], error: err instanceof Error ? err.message : String(err) };
  }
}

/**
 * Pull the latest N items out of an RSS / Atom feed. The
 * extractor is tolerant: it looks for `<item>` (RSS) and
 * `<entry>` (Atom) and tries several field names for the
 * body, the URL, and the title.
 */
export function extractItems(xml: string, limit: number): ReadonlyArray<FetchedItem> {
  const items: FetchedItem[] = [];
  const itemBlocks = matchBlocks(xml, /<item[\s>]/gi).concat(matchBlocks(xml, /<entry[\s>]/gi));
  for (const block of itemBlocks) {
    if (items.length >= limit) break;
    const title = firstMatch(block, /<title[^>]*>([\s\S]*?)<\/title>/i) ?? '(untitled)';
    const url = firstMatch(block, /<link[^>]*href=["']([^"']+)["']/i)
      ?? firstMatch(block, /<link[^>]*>([\s\S]*?)<\/link>/i)
      ?? firstMatch(block, /<id[^>]*>([\s\S]*?)<\/id>/i)
      ?? '';
    const excerpt = stripTags(firstMatch(block, /<(?:description|summary|content)[\s\S]*?>([\s\S]*?)<\/(?:description|summary|content)>/i) ?? '').slice(0, 600);
    items.push({ title: stripTags(title).trim(), url: url.trim(), excerpt: excerpt.trim() });
  }
  return items;
}

/** Find the start positions of every block whose opening tag matches `tagRe`. */
function matchBlocks(xml: string, tagRe: RegExp): string[] {
  const blocks: string[] = [];
  for (const m of xml.matchAll(tagRe)) {
    const start = m.index ?? 0;
    const end = findMatchingClose(xml, start, m[0].startsWith('<item') ? 'item' : 'entry');
    if (end > start) blocks.push(xml.slice(start, end));
  }
  return blocks;
}

/** Locate the matching closing tag for the block that starts at `start`. Naive but sufficient for typical feeds. */
function findMatchingClose(xml: string, start: number, tag: 'item' | 'entry'): number {
  const close = `</${tag}>`;
  const selfClose = `<${tag}`;
  const candidate = xml.indexOf(close, start);
  if (candidate < 0) return -1;
  // If the opener was self-closing (`<item .../>`), there is no body.
  const openerEnd = xml.indexOf('>', start);
  if (openerEnd > 0 && xml[openerEnd - 1] === '/') return -1;
  void selfClose;
  return candidate + close.length;
}

/** Return the first capture group of `re` over `text`, or null. */
function firstMatch(text: string, re: RegExp): string | null {
  const m = re.exec(text);
  if (m === null) return null;
  return m[1] ?? null;
}

/** Drop all HTML tags and decode a few common XML entities. */
export function stripTags(s: string): string {
  return s
    .replace(/<[^>]*>/g, ' ')
    .replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, '$1')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&apos;/g, "'")
    .replace(/&amp;/g, '&')
    .replace(/\s+/g, ' ');
}
