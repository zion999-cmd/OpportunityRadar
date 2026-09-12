import { useMemo } from 'react';
import { AlertTriangle, CalendarDays, ChevronRight, Newspaper, RotateCw } from 'lucide-react';
import { useAppData } from '../app-data.js';
import { buildMagazine } from '../view-models/semantic-card.js';
import { HeroCard, SemanticCardView } from '../components/cards.js';
import { navigate } from '../router.js';

export function MagazinePage(): JSX.Element {
  const { inbox, loading, error, reload } = useAppData();
  const magazine = useMemo(() => buildMagazine(inbox), [inbox]);

  if (loading && inbox.length === 0) {
    return (
      <div className="state-panel" role="status" aria-live="polite">
        <div className="spinner" />
        <h3>正在恢复世界的意义…</h3>
        <p>Observation 正在把 Evidence 组织成与你有关的语义。</p>
      </div>
    );
  }

  if (error !== null && inbox.length === 0) {
    return (
      <div className="state-panel">
        <h3>暂时无法加载今日机会</h3>
        <p>{error}</p>
        <button type="button" className="btn btn--soft" onClick={() => void reload()}>
          <RotateCw size={15} /> 重试
        </button>
      </div>
    );
  }

  const todayLabel = new Intl.DateTimeFormat('zh-CN', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
    weekday: 'long',
  }).format(new Date());

  return (
    <div>
      {magazine.usingDemo && (
        <div className="demo-banner">
          <AlertTriangle size={16} />
          <span>
            当前还没有真实 Observation 结果，下方为<strong>设计示例</strong>（已标注「示例」），用于展示 Surface 形态。
          </span>
          <button type="button" className="btn btn--soft" onClick={() => navigate('/radar')}>
            去运行 Observation
          </button>
        </div>
      )}
      {!magazine.usingDemo && magazine.demoFillFrom !== null && (
        <div className="demo-banner">
          <AlertTriangle size={16} />
          <span>
            头条来自真实 Evidence；网格尾部为<strong>设计示例</strong>（已标注「示例」），因为当前真实结果还不足以填满杂志版面。
          </span>
        </div>
      )}

      <HeroCard card={magazine.hero} />

      <div className="section-head">
        <h2>今日恢复的意义</h2>
        <span className="meta">
          <CalendarDays size={14} /> {todayLabel}
          <span style={{ margin: '0 4px' }}>·</span>
          <Newspaper size={14} /> {magazine.grid.length + 1} 个语义卡片
        </span>
      </div>

      <div className="card-grid">
        {magazine.grid.map((card) => (
          <SemanticCardView key={card.id} card={card} />
        ))}
      </div>

      <div className="card-section__label" style={{ marginTop: 30 }}>
        <ChevronRight size={14} /> 语义卡片由现有 relationship 结果映射；原始 Observation Feed 已移至「关注主题 / Radar」。
      </div>
    </div>
  );
}
