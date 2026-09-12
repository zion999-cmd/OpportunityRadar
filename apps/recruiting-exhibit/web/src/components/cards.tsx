import { ArrowRight, CalendarDays, FileText, Link2, Sparkles, UserCheck } from 'lucide-react';
import type { SemanticCard } from '../view-models/semantic-card.js';
import { clip, formatDateZh, formatRelative } from '../format.js';
import { navigate } from '../router.js';

const BADGE_VARIANTS: Readonly<Record<string, string>> = {
  今日头条: 'badge--blue',
  人才需求: 'badge--green',
  新兴机会: 'badge--green',
  行业趋势: 'badge--teal',
  工作方式: 'badge--teal',
  公司动态: 'badge--amber',
  技能建议: 'badge--violet',
  复盘洞察: 'badge--violet',
  工程实践: 'badge--blue',
  开源动态: 'badge--teal',
};

function badgeClass(label: string): string {
  return BADGE_VARIANTS[label] ?? 'badge--slate';
}

function openCard(card: SemanticCard): void {
  navigate(`/meaning/${encodeURIComponent(card.id)}`);
}

// ---------------------------------------------------------------------------
// Hero semantic card — one recovered meaning, image-first, with
// honest evidence indicators and a personal-relationship hint.
// ---------------------------------------------------------------------------

export function HeroCard({ card }: { readonly card: SemanticCard }): JSX.Element {
  const dateLabel = formatDateZh(card.surfacedAt);
  return (
    <article className="hero">
      <img className="hero__img" src={card.imageUrl} alt="" />
      <div className="hero__scrim" />

      <p className="hero__quote">让世界的信息，为你恢复出意义与关系。</p>

      <div className="hero__body">
        <div className="hero__meta">
          <span className={`badge ${badgeClass(card.badge)}`}>
            <Sparkles size={12} /> {card.badge}
          </span>
          {card.isDemo && <span className="demo-tag">示例</span>}
          {dateLabel.length > 0 && <span className="hero__date">{dateLabel}</span>}
        </div>

        <h1 className="hero__title">{card.title}</h1>
        <p className="hero__summary">{card.summary}</p>

        <div className="hero__foot">
          <div className="hero__stats">
            <span className="hero__stat">
              <FileText size={15} />
              <b>{card.evidenceCount}</b> 条 Evidence
            </span>
            <span className="hero__stat" title={card.whyRelated}>
              <UserCheck size={15} /> 与你有关
            </span>
            {card.sources.slice(0, 3).map((source) => (
              <span key={source.label} className="hero__stat">
                <Link2 size={14} /> {source.label}
              </span>
            ))}
          </div>
          <button type="button" className="hero__cta" onClick={() => openCard(card)}>
            查看恢复的意义 <ArrowRight size={15} />
          </button>
        </div>
      </div>
    </article>
  );
}

// ---------------------------------------------------------------------------
// Magazine grid card — varying sizes tile the 6-column grid.
// ---------------------------------------------------------------------------

export function SemanticCardView({ card }: { readonly card: SemanticCard }): JSX.Element {
  return (
    <article className={`sem-card sem-card--${card.size}`}>
      <button
        type="button"
        className="sem-card__media"
        style={{ padding: 0, border: 'none', cursor: 'pointer' }}
        onClick={() => openCard(card)}
        aria-label={`查看：${card.title}`}
      >
        <img src={card.imageUrl} alt="" loading="lazy" />
        <span className="sem-card__badges">
          <span className={`badge ${badgeClass(card.badge)}`}>{card.badge}</span>
          {card.isDemo && <span className="demo-tag">示例</span>}
        </span>
      </button>

      <div className="sem-card__body">
        <h3 className="sem-card__title">{card.title}</h3>
        <p className="sem-card__summary">{clip(card.summary, card.size === 'small' ? 56 : 92)}</p>

        <div className="evidence-preview">
          <span className="ep">
            <FileText size={13} /> {card.evidenceCount} 条 Evidence
          </span>
          {card.sources.slice(0, 2).map((source) => (
            <span key={source.label} className="ep">
              <Link2 size={13} /> {source.label}
            </span>
          ))}
          {card.surfacedAt.length > 0 && (
            <span className="ep">
              <CalendarDays size={13} /> {formatRelative(card.surfacedAt)}
            </span>
          )}
        </div>

        <div className="relation-preview" title={card.whyRelated}>
          <b>与你有关：</b>
          {clip(card.whyRelated, 48)}
        </div>
      </div>

      <button type="button" className="sem-card__cta" onClick={() => openCard(card)}>
        查看语义详情 <ArrowRight size={15} />
      </button>
    </article>
  );
}
