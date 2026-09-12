import { useMemo, useState } from 'react';
import {
  ArrowDown,
  Check,
  ChevronLeft,
  ExternalLink,
  HelpCircle,
  MessageSquare,
  Rss,
  Search,
  ShieldCheck,
  ThumbsUp,
  XCircle,
} from 'lucide-react';
import { postFeedback, type FeedbackButton } from '../api.js';
import { useAppData } from '../app-data.js';
import { buildMagazine, findCard, type SemanticCard, type SourcePreview } from '../view-models/semantic-card.js';
import { clip, formatDateZh } from '../format.js';
import { navigate } from '../router.js';

interface MeaningDetailPageProps {
  readonly id: string;
}

const FEEDBACK_BUTTONS: ReadonlyArray<{ readonly id: FeedbackButton; readonly label: string }> = [
  { id: 'worth_talking', label: '值得进一步行动' },
  { id: 'investigate_more', label: '继续观察' },
  { id: 'not_relevant', label: '与我无关' },
];

export function MeaningDetailPage({ id }: MeaningDetailPageProps): JSX.Element {
  const { inbox, situation, loading, showToast } = useAppData();
  const magazine = useMemo(() => buildMagazine(inbox), [inbox]);
  const card = findCard(magazine, id);

  if (loading && inbox.length === 0) {
    return (
      <div className="state-panel" role="status">
        <div className="spinner" />
        <h3>正在载入语义…</h3>
      </div>
    );
  }

  if (card === undefined) {
    return (
      <div className="not-found">
        <h2>没有找到这条语义</h2>
        <p>它可能来自更早的 Observation 周期，或链接已失效。</p>
        <button type="button" className="btn btn--soft" onClick={() => navigate('/')}>
          <ChevronLeft size={15} /> 返回今日机会
        </button>
      </div>
    );
  }

  const situationLine = situation?.rawText ?? '尚未填写 Situation。';

  return (
    <div className="detail">
      <button type="button" className="crumb" onClick={() => navigate('/')}>
        <ChevronLeft size={14} /> 今日机会
      </button>

      <DetailHero card={card} />

      <section className="detail-section" aria-label="Recovered Meaning">
        <h2>
          <span className="n">1</span> 恢复出的意义
        </h2>
        <div className="why-card">
          <p>{card.impliedMeaning.length > 0 ? card.impliedMeaning : card.summary}</p>
          <p style={{ marginTop: 10, color: 'var(--text-2)', fontSize: 13 }}>
            <ShieldCheck size={14} style={{ verticalAlign: -2, marginRight: 4 }} />
            本条判断实际使用的 Evidence：{card.evidenceUsed}
          </p>
        </div>
      </section>

      <section className="detail-section" aria-label="Why this matters to you">
        <h2>
          <span className="n">2</span> 为什么与你有关
        </h2>
        <div className="why-card">
          <p>{card.whyRelated}</p>
        </div>
      </section>

      <section className="detail-section" aria-label="关系图">
        <h2>
          <span className="n">3</span> 关系是如何恢复出来的
        </h2>
        <div className="relation-flow">
          <FlowNode
            tone="you"
            kind="你的经历 · Situation Evidence"
            value={clip(situationLine, 140)}
          />
          <FlowArrow />
          <FlowNode
            tone="meaning"
            kind="Evidence 恢复出的意义（能力 / 需求解释）"
            value={card.impliedMeaning.length > 0 ? card.impliedMeaning : card.summary}
          />
          <FlowArrow />
          <FlowNode tone="world" kind="世界正在发生的变化（Evidence 观察到的事实）" value={card.summary} />
          <FlowArrow />
          <FlowNode tone="relation" kind="潜在关系（尚待验证）" value={card.whyRelated} />
        </div>
        <p className="feedback-note">这是对推理链的轻量呈现，不是确定性结论；没有使用任何图谱框架。</p>
      </section>

      <EvidenceSection card={card} />

      <section className="detail-section" aria-label="Still Unknown">
        <h2>
          <span className="n">5</span> 仍然未知
        </h2>
        <div className="unknown-card">
          <HelpCircle size={20} />
          <div>
            <h3>Still Unknown — 这一区块不可删除</h3>
            <p>{card.unknown}</p>
          </div>
        </div>
      </section>

      <FeedbackBlock card={card} onSaved={showToast} />
    </div>
  );
}

function DetailHero({ card }: { readonly card: SemanticCard }): JSX.Element {
  const dateLabel = formatDateZh(card.surfacedAt);
  return (
    <div className="detail-hero">
      <img src={card.imageUrl} alt="" />
      <div className="detail-hero__body">
        <div className="detail-hero__meta">
          <span className="badge badge--ghost">{card.badge}</span>
          {card.isDemo && <span className="demo-tag">示例</span>}
          {dateLabel.length > 0 && <span>{dateLabel} 恢复</span>}
        </div>
        <h1 className="detail-hero__title">{card.title}</h1>
        <p className="detail-hero__summary">{card.summary}</p>
      </div>
    </div>
  );
}

function FlowNode({ tone, kind, value }: { readonly tone: string; readonly kind: string; readonly value: string }): JSX.Element {
  return (
    <div className={`flow-node flow-node--${tone}`}>
      <div className="k">{kind}</div>
      <div className="v">{value}</div>
    </div>
  );
}

function FlowArrow(): JSX.Element {
  return (
    <span className="flow-arrow" aria-hidden>
      <ArrowDown size={18} />
    </span>
  );
}

function EvidenceSection({ card }: { readonly card: SemanticCard }): JSX.Element {
  const groups = groupByLabel(card.sources);
  return (
    <section className="detail-section" aria-label="Evidence 信任层">
      <h2>
        <span className="n">4</span> Evidence（信任层 · {card.evidenceCount} 条）
      </h2>
      {groups.map(([label, items]) => (
        <div className="evidence-group" key={label}>
          <div className="evidence-group__head">
            <ShieldCheck size={15} color="var(--primary)" /> {label}
            <span className="muted" style={{ fontSize: 12, fontWeight: 400 }}>
              {items.length} 个来源
            </span>
          </div>
          {items.map((source, i) => (
            <EvidenceItem key={`${source.url}-${i}`} source={source} />
          ))}
        </div>
      ))}
    </section>
  );
}

function EvidenceItem({ source }: { readonly source: SourcePreview }): JSX.Element {
  return (
    <div style={{ padding: '8px 0', borderTop: '1px solid var(--border)' }}>
      <div className="evidence-item__title">{source.title}</div>
      {source.excerpt.length > 0 && <p className="evidence-item__excerpt">{source.excerpt}</p>}
      <div className="evidence-item__links">
        {source.url.length > 0 ? (
          <a href={source.url} target="_blank" rel="noopener noreferrer">
            <ExternalLink size={13} /> 查看原文
          </a>
        ) : (
          <span className="disabled-link">
            <XCircle size={13} /> 暂无可访问的原文链接
          </span>
        )}
        {source.feedUrl.length > 0 && (
          <a href={source.feedUrl} target="_blank" rel="noopener noreferrer">
            <Rss size={13} /> 来源 Feed
          </a>
        )}
      </div>
    </div>
  );
}

function FeedbackBlock({
  card,
  onSaved,
}: {
  readonly card: SemanticCard;
  readonly onSaved: (message: string) => void;
}): JSX.Element {
  const [picked, setPicked] = useState<FeedbackButton | null>(null);
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function send(button: FeedbackButton): Promise<void> {
    setSending(true);
    setError(null);
    try {
      await postFeedback(card.id, button);
      setPicked(button);
      onSaved('反馈已记录，会影响后续 Observation 的呈现');
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setSending(false);
    }
  }

  return (
    <section className="detail-section">
      <div className="feedback-card">
        <h2 style={{ fontSize: 15, fontWeight: 800 }}>这条语义对你有用吗？</h2>
        <div className="feedback-row">
          {FEEDBACK_BUTTONS.map((button) => {
            const Icon = button.id === 'not_relevant' ? XCircle : button.id === 'investigate_more' ? Search : ThumbsUp;
            const className = `feedback-btn${picked === button.id ? ' feedback-btn--picked' : ''}`;
            return (
              <button
                key={button.id}
                type="button"
                className={className}
                disabled={sending || card.isDemo}
                title={card.isDemo ? '示例内容不记录反馈' : undefined}
                onClick={() => void send(button.id)}
              >
                {picked === button.id ? <Check size={14} /> : <Icon size={14} />}
                {button.label}
              </button>
            );
          })}
        </div>
        {card.isDemo ? (
          <p className="feedback-note">示例内容不记录反馈；对真实语义的反馈会写入现有 /api/feedback。</p>
        ) : (
          <p className="feedback-note">反馈进入现有 exhibit_feedback 记录，不会触发任何自动投递。</p>
        )}
        {error !== null && (
          <p className="feedback-note" style={{ color: 'var(--danger)' }}>
            {error}
          </p>
        )}

        <div className="coming-soon" style={{ marginTop: 16 }}>
          <MessageSquare size={16} />
          讨论 / 补充 Evidence（即将开放）——Surface 版本不提供评论系统。
        </div>
      </div>
    </section>
  );
}

// Preserve first-seen label order while grouping (immutable).
function groupByLabel(sources: ReadonlyArray<SourcePreview>): ReadonlyArray<readonly [string, SourcePreview[]]> {
  const order: string[] = [];
  const map = new Map<string, SourcePreview[]>();
  for (const source of sources) {
    const existing = map.get(source.label);
    if (existing === undefined) {
      map.set(source.label, [{ ...source }]);
      order.push(source.label);
    } else {
      existing.push({ ...source });
    }
  }
  return order.map((label) => [label, map.get(label) ?? []] as const);
}
