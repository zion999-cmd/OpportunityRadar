// apps/recruiting-exhibit/sources.ts — the 4 fixed public
// engineering-blog / professional-writeup feeds the exhibit
// fetches every observation run.
//
// Per task.md §"Observation Scope":
//   "不做全网爬虫。只选 3~5 个固定公开来源。"
//   "来源优先：engineering blogs / public technical
//    retrospectives / GitHub/project public writeups /
//    conference/public professional writeups."
//   "不追求数量。每轮哪怕只有 5~20 条新 Evidence 都可以。"
//
// We pick 4 well-known, stable, low-friction engineering feeds
// that have produced public postmortems, retrospectives, and
// engineering writeups continuously for years. We deliberately
// do NOT include sites that aggressively block scrapers
// (LinkedIn, Twitter, etc.) — the exhibit must run reliably in
// a demo environment.
//
// Each source carries a stable `kind` so the UI can label the
// origin of every Evidence item ("engineering blog",
// "open-source retrospective", etc.) without inferring it from
// the URL.

export type SourceKind = 'engineering_blog' | 'engineering_retrospective' | 'open_source_writeup';

export interface FixedSource {
  readonly id: string;
  readonly label: string;
  readonly kind: SourceKind;
  /** Public RSS / Atom feed URL. */
  readonly url: string;
  /**
   * Maximum number of items the fetcher will keep from this
   * source per run. Keeps each run's total Evidence small and
   * bounded (target: 5–20 items per run, across all sources).
   */
  readonly maxItems: number;
}

export const FIXED_SOURCES: ReadonlyArray<FixedSource> = [
  {
    id: 'github-engineering',
    label: 'GitHub Engineering Blog',
    kind: 'engineering_blog',
    url: 'https://github.blog/engineering/feed/',
    maxItems: 4,
  },
  {
    id: 'cloudflare-engineering',
    label: 'Cloudflare Engineering Blog',
    kind: 'engineering_blog',
    url: 'https://blog.cloudflare.com/tag/engineering/rss',
    maxItems: 4,
  },
  {
    id: 'martinfowler',
    label: 'Martin Fowler',
    kind: 'engineering_retrospective',
    url: 'https://martinfowler.com/feed.atom',
    maxItems: 3,
  },
  {
    id: 'vercel-engineering',
    label: 'Vercel Engineering Blog',
    kind: 'open_source_writeup',
    url: 'https://vercel.com/atom',
    maxItems: 3,
  },
];
