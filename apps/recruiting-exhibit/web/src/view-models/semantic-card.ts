// Frontend read-side view model for POC-SURFACE-01.
//
// This file is intentionally pure (no React, no DOM) so the
// mapping rules can be unit-tested under the repository's
// existing Vitest setup and stay framework-neutral. It is a UI
// view model — it is NOT a new Semantic Native domain schema:
// the input is the existing /api/inbox payload
// (InboxEntry = one surfaced relationship result + its evidence
// + its source item), and the output is what one magazine card
// renders.
//
// First-version data reality (task.md §"First Version Data
// Reality"): the backend does not yet produce cross-source
// semantic cards, so one surfaced relationship maps to one
// card. When the inbox is empty (or thinner than the magazine
// grid), a built-in DEMO dataset is used so the Surface can be
// evaluated visually; every demo card is flagged `isDemo` and
// rendered with a "示例" marker. The backend is never asked to
// fabricate anything.

import type { InboxEntry } from '../../../../../apps/recruiting-exhibit/views.js';
import { FIXED_SOURCES, type SourceKind } from '../../../../../apps/recruiting-exhibit/sources.js';

export interface SourcePreview {
  readonly label: string;
  readonly title: string;
  readonly url: string;
  readonly feedUrl: string;
  readonly excerpt: string;
}

export type CardSize = 'large' | 'medium' | 'small';

export interface SemanticCard {
  readonly id: string;
  /** Recovered Meaning title — never a raw news headline. */
  readonly title: string;
  /** 1–2 sentence semantic summary. */
  readonly summary: string;
  readonly imageUrl: string;
  /** Small semantic-type badge label. */
  readonly badge: string;
  readonly evidenceCount: number;
  readonly sources: ReadonlyArray<SourcePreview>;
  /** Personal relationship hint ("与你有关"). */
  readonly whyRelated: string;
  /** The "Still Unknown" content — mandatory on detail. */
  readonly unknown: string;
  readonly evidenceUsed: string;
  readonly impliedMeaning: string;
  readonly surfacedAt: string;
  readonly size: CardSize;
  readonly isDemo: boolean;
}

export interface Magazine {
  readonly hero: SemanticCard;
  readonly grid: ReadonlyArray<SemanticCard>;
  /** true when the hero itself is demo content (inbox empty). */
  readonly usingDemo: boolean;
  /** Index at which demo filler cards begin in `grid`, or null. */
  readonly demoFillFrom: number | null;
}

/** Grid must look like a magazine even on a fresh database. */
export const MIN_GRID_CARDS = 6;
const IMAGE_VARIANTS = 6;

const KIND_BADGE: Record<SourceKind, string> = {
  engineering_blog: '工程实践',
  engineering_retrospective: '复盘洞察',
  open_source_writeup: '开源动态',
};

const SOURCE_KIND_BY_LABEL: ReadonlyMap<string, SourceKind> = new Map(
  FIXED_SOURCES.map((s) => [s.label, s.kind]),
);

function badgeForSourceLabel(label: string): string {
  const kind = SOURCE_KIND_BY_LABEL.get(label);
  return kind === undefined ? '语义信号' : KIND_BADGE[kind];
}

function imageForId(id: string): string {
  let hash = 0;
  for (let i = 0; i < id.length; i += 1) {
    hash = (hash * 31 + id.charCodeAt(i)) | 0;
  }
  const variant = Math.abs(hash) % IMAGE_VARIANTS;
  return `/images/meaning-${variant + 1}.svg`;
}

/**
 * The grid cycles through width classes that tile a 6-column
 * desktop grid exactly (3+2+1, 2+2+2, 3+3, …) so different
 * evidence coverage yields visually different card sizes
 * without leaving gaps.
 */
const SIZE_CYCLE: ReadonlyArray<CardSize> = [
  'large',
  'medium',
  'small',
  'medium',
  'medium',
  'medium',
  'large',
  'large',
];

export function sizeAtPosition(position: number): CardSize {
  return SIZE_CYCLE[position % SIZE_CYCLE.length] ?? 'medium';
}

export function mapInboxEntry(entry: InboxEntry, position: number): SemanticCard {
  const sources: SourcePreview[] = [
    {
      label: entry.sourceLabel,
      title: entry.sourceTitle.length > 0 ? entry.sourceTitle : entry.claim,
      url: entry.sourceUrl,
      feedUrl: entry.feedUrl,
      excerpt: entry.rawExcerpt,
    },
  ];
  return {
    id: entry.relationshipId,
    // Title = the recovered meaning (stage-2 interpretation),
    // never the raw reconstructed claim / article title. The
    // claim remains visible as the card's supporting summary and
    // in the detail-page Evidence trust layer.
    title: entry.impliedMeaning.length > 0 ? entry.impliedMeaning : entry.claim,
    summary: entry.claim,
    imageUrl: imageForId(entry.relationshipId),
    badge: badgeForSourceLabel(entry.sourceLabel),
    evidenceCount: 1,
    sources,
    whyRelated: entry.whyRelevant,
    unknown: entry.mostImportantUnknown,
    evidenceUsed: entry.evidenceUsed,
    impliedMeaning: entry.impliedMeaning,
    surfacedAt: entry.surfacedAt,
    size: sizeAtPosition(position),
    isDemo: false,
  };
}

export function buildMagazine(entries: ReadonlyArray<InboxEntry>): Magazine {
  if (entries.length === 0) {
    return {
      hero: DEMO_HERO,
      grid: DEMO_GRID.map((card, i) => ({ ...card, size: sizeAtPosition(i) })),
      usingDemo: true,
      demoFillFrom: null,
    };
  }

  const hero = { ...mapInboxEntry(entries[0]!, -1), size: 'large' as CardSize, imageUrl: '/images/hero.svg' };
  const realCards = entries.slice(1).map((entry, i) => mapInboxEntry(entry, i + 1));
  const grid: SemanticCard[] = [...realCards];

  let demoFillFrom: number | null = null;
  if (grid.length < MIN_GRID_CARDS) {
    demoFillFrom = grid.length;
    // Skip hero demo (already used as the hero only for an empty
    // inbox); fill the tail with grid demos.
    for (const demo of DEMO_GRID) {
      if (grid.length >= MIN_GRID_CARDS) break;
      grid.push({ ...demo, size: sizeAtPosition(grid.length) });
    }
  }

  return { hero, grid, usingDemo: false, demoFillFrom };
}

export function findCard(magazine: Magazine, id: string): SemanticCard | undefined {
  if (magazine.hero.id === id) return magazine.hero;
  return magazine.grid.find((card) => card.id === id);
}

// ---------------------------------------------------------------------------
// Demo content (Surface validation only — rendered with a 示例 marker).
// Copy mirrors the agreed visual reference; sources carry no
// URLs so the Evidence section cannot be mistaken for real
// provenance and the links render disabled.
// ---------------------------------------------------------------------------

const DEMO_UNKNOWN =
  '当前证据仍不能确认这种需求是否已经形成稳定、持续的职位类别，还是项目制 / 阶段性投入。需要更多跨周期观察。';

function demoSources(labels: ReadonlyArray<string>): ReadonlyArray<SourcePreview> {
  return labels.map((label) => ({
    label,
    title: '示例来源（非真实 Evidence）',
    url: '',
    feedUrl: '',
    excerpt: '这是设计示例内容，不对应任何真实抓取的 Evidence。',
  }));
}

export const DEMO_HERO: SemanticCard = {
  id: 'demo-hero',
  title: '企业 AI 转型正在重新定义人才需求',
  summary:
    '从模型能力到业务落地，企业开始大规模招聘“懂业务 + 会用 AI”的复合型人才。',
  imageUrl: '/images/hero.svg',
  badge: '今日头条',
  evidenceCount: 3,
  sources: demoSources(['招聘信号', '企业动态', '技术进展']),
  whyRelated: '你的企业系统 / 流程经验，可能在 AI 落地浪潮中形成新的迁移关系。',
  unknown: DEMO_UNKNOWN,
  evidenceUsed: '示例：多来源招聘信号与企业动态汇总（设计示例，非真实 Evidence）。',
  impliedMeaning:
    '企业正在从单纯寻找“会用 AI”的人，转向寻找能够理解业务流程并推动 AI 落地的人。',
  surfacedAt: '',
  size: 'large',
  isDemo: true,
};

const DEMO_GRID_DEFS: ReadonlyArray<Omit<SemanticCard, 'size'>> = [
  {
    id: 'demo-talent',
    title: '企业急需具备业务流程理解能力的 AI 落地人才',
    summary: '越来越多的企业在招聘中强调“懂业务、会用 AI、能推动落地”的复合能力。',
    imageUrl: '/images/meaning-1.svg',
    badge: '人才需求',
    evidenceCount: 3,
    sources: demoSources(['招聘', '企业', '文章']),
    whyRelated: '你的 ERP / 系统实施经验，与当前 AI 落地需求高度相关。',
    unknown: DEMO_UNKNOWN,
    evidenceUsed: '示例：招聘 JD 语义聚类（设计示例）。',
    impliedMeaning: '“能把 AI 接进真实业务流程”正在成为独立的人才评价维度。',
    surfacedAt: '',
    isDemo: true,
  },
  {
    id: 'demo-business-ai',
    title: 'AI 正在从技术部门走向业务部门',
    summary: '市场、运营、供应链等部门开始设立 AI 应用岗位，需求快速增加。',
    imageUrl: '/images/meaning-2.svg',
    badge: '行业趋势',
    evidenceCount: 3,
    sources: demoSources(['招聘', '企业', '文章']),
    whyRelated: '你的跨部门协作经验可能成为重要迁移优势。',
    unknown: '业务部门的 AI 岗位目前职责边界仍然模糊，长期归属尚不确定。',
    evidenceUsed: '示例：跨部门岗位分布对比（设计示例）。',
    impliedMeaning: 'AI 能力的组织位置正在从集中式技术团队扩散到一线业务单元。',
    surfacedAt: '',
    isDemo: true,
  },
  {
    id: 'demo-energy',
    title: '新能源与 AI 结合领域出现新岗位',
    summary: '能源企业正在招聘具备数据分析和行业理解能力的复合型人才。',
    imageUrl: '/images/meaning-3.svg',
    badge: '新兴机会',
    evidenceCount: 3,
    sources: demoSources(['招聘', '企业', '文章']),
    whyRelated: '你的数据分析能力可以迁移到新的行业场景。',
    unknown: '新能源 + AI 的岗位总量仍小，是否成为持续趋势还需观察。',
    evidenceUsed: '示例：新能源行业招聘信号（设计示例）。',
    impliedMeaning: '行业 know-how 与数据能力的组合正在产生新的职业交叉点。',
    surfacedAt: '',
    isDemo: true,
  },
  {
    id: 'demo-remote',
    title: '远程 + 灵活用工正在成为更多企业的选择',
    summary: '多家企业扩大远程岗位招聘，尤其是技术、产品和运营类岗位。',
    imageUrl: '/images/meaning-4.svg',
    badge: '工作方式',
    evidenceCount: 3,
    sources: demoSources(['招聘', '企业', '文章']),
    whyRelated: '你的经验在跨地域远程团队中同样适用。',
    unknown: '远程岗位的扩张是否会在经济周期中反转，目前没有足够证据。',
    evidenceUsed: '示例：远程岗位占比变化（设计示例）。',
    impliedMeaning: '用工地点与雇佣形态的约束正在持续放松。',
    surfacedAt: '',
    isDemo: true,
  },
  {
    id: 'demo-companies',
    title: '这些公司正在加大 AI 相关招聘',
    summary: '过去 30 天内，AI 相关岗位增长最快的一组公司。',
    imageUrl: '/images/meaning-5.svg',
    badge: '公司动态',
    evidenceCount: 2,
    sources: demoSources(['企业', '招聘']),
    whyRelated: '这些公司的业务方向与你的系统落地经验存在交集。',
    unknown: '招聘增长可能由短期项目驱动，不代表长期组织投入。',
    evidenceUsed: '示例：公司级招聘增速排序（设计示例）。',
    impliedMeaning: 'AI 招聘需求正在向少数投入坚决的公司集中。',
    surfacedAt: '',
    isDemo: true,
  },
  {
    id: 'demo-skills',
    title: '提升这些技能，可能带来更多机会',
    summary: '基于市场需求和你的背景，值得关注：AI 产品应用、业务流程设计、数据分析、Prompt 工程、项目管理。',
    imageUrl: '/images/meaning-6.svg',
    badge: '技能建议',
    evidenceCount: 2,
    sources: demoSources(['招聘', '文章']),
    whyRelated: '这些方向都建立在你已有的企业系统经验之上，而非从零开始。',
    unknown: '技能建议来自当前窗口的需求信号，技能本身的半衰期尚不确定。',
    evidenceUsed: '示例：技能需求频次（设计示例）。',
    impliedMeaning: '最具迁移价值的技能是“业务理解 + AI 应用”的交叉层。',
    surfacedAt: '',
    isDemo: true,
  },
];

export const DEMO_GRID: ReadonlyArray<SemanticCard> = DEMO_GRID_DEFS.map((card) => ({
  ...card,
  size: 'medium',
}));
