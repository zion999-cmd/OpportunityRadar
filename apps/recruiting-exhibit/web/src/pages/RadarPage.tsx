import { useEffect, useState } from 'react';
import {
  AlertTriangle,
  Clock,
  Database,
  ExternalLink,
  Eye,
  EyeOff,
  Layers,
  Play,
  RotateCw,
  Rss,
} from 'lucide-react';
import { fetchFeed, triggerObservationRun, type FeedEntry, type RunResponse } from '../api.js';
import { useAppData } from '../app-data.js';
import { formatDateZh, formatRelative } from '../format.js';

type RunState = { readonly kind: 'idle' } | { readonly kind: 'running' } | { readonly kind: 'ok'; readonly result: RunResponse } | { readonly kind: 'error'; readonly message: string };

export function RadarPage(): JSX.Element {
  const { status, reload } = useAppData();
  const [feed, setFeed] = useState<ReadonlyArray<FeedEntry>>([]);
  const [feedLoading, setFeedLoading] = useState(true);
  const [feedError, setFeedError] = useState<string | null>(null);
  const [runState, setRunState] = useState<RunState>({ kind: 'idle' });

  useEffect(() => {
    let cancelled = false;
    setFeedLoading(true);
    fetchFeed()
      .then((entries) => {
        if (!cancelled) {
          setFeed(entries);
          setFeedError(null);
        }
      })
      .catch((err: unknown) => {
        if (!cancelled) setFeedError(err instanceof Error ? err.message : String(err));
      })
      .finally(() => {
        if (!cancelled) setFeedLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  async function runNow(): Promise<void> {
    setRunState({ kind: 'running' });
    try {
      const result = await triggerObservationRun();
      setRunState({ kind: 'ok', result });
      await reload();
    } catch (err: unknown) {
      setRunState({ kind: 'error', message: err instanceof Error ? err.message : String(err) });
    }
  }

  return (
    <div className="detail">
      <div className="section-head" style={{ margin: '4px 0 16px' }}>
        <h2 style={{ fontSize: 21 }}>Observation Radar · 关注追踪</h2>
        <button type="button" className="btn btn--primary" onClick={() => void runNow()} disabled={runState.kind === 'running'}>
          {runState.kind === 'running' ? <RotateCw size={15} className="spin" /> : <Play size={15} />}
          {runState.kind === 'running' ? 'Observation 运行中…' : '立即运行一轮'}
        </button>
      </div>

      <RunResult state={runState} />

      <div className="radar-grid">
        <Metric icon={<Database size={16} />} caption="已恢复 Evidence" num={status?.totalEvidenceCount ?? 0} sub="exhibit_reconstructed_evidence" />
        <Metric icon={<Eye size={16} />} caption="已呈现关系" num={status?.totalSurfaces ?? 0} sub="surface_decision = surface" />
        <Metric
          icon={<Clock size={16} />}
          caption="最近一次 Observation"
          text={formatRelative(status?.lastObservationAt) || '尚未运行'}
          sub={status?.lastRunStatus === null ? '' : `状态：${runStatusLabel(status?.lastRunStatus)}`}
        />
        <Metric
          icon={<Layers size={16} />}
          caption="下一次计划运行"
          text={formatDateZh(status?.nextObservationAt) || '—'}
          sub={`最近一轮新增 Evidence ${status?.newEvidenceCount ?? 0} · 关系 ${status?.newRelationshipCount ?? 0}`}
        />
      </div>

      {status !== null && status.lastError !== null && status.lastError.length > 0 && (
        <div className="run-error" style={{ marginBottom: 18 }}>
          <AlertTriangle size={14} style={{ verticalAlign: -2, marginRight: 6 }} />
          最近一次运行的错误记录：{status.lastError}
        </div>
      )}

      <div className="section-head" style={{ margin: '8px 0 12px' }}>
        <h2 style={{ fontSize: 16 }}>原始 Observation Feed</h2>
        <span className="meta">最近 {feed.length} 条 · 仅作监测，不在首页杂志出现</span>
      </div>

      {feedLoading && (
        <div className="state-panel">
          <div className="spinner" />
          <h3>正在读取 Feed…</h3>
        </div>
      )}
      {!feedLoading && feedError !== null && (
        <div className="state-panel">
          <h3>Feed 加载失败</h3>
          <p>{feedError}</p>
        </div>
      )}
      {!feedLoading && feedError === null && feed.length === 0 && (
        <div className="state-panel">
          <h3>还没有 Observation 记录</h3>
          <p>点击右上角「立即运行一轮」，从固定信息源恢复第一批 Evidence。</p>
        </div>
      )}

      <div className="feed-list">
        {feed.map((entry) => (
          <FeedItemView key={entry.evidenceId} entry={entry} />
        ))}
      </div>
    </div>
  );
}

function RunResult({ state }: { readonly state: RunState }): JSX.Element | null {
  if (state.kind === 'ok') {
    const { result } = state;
    if (result.status === 'failed') {
      return (
        <div className="run-error" style={{ marginBottom: 18 }}>
          本轮运行失败：{result.errorMessage ?? '未提供错误信息'}
        </div>
      );
    }
    return (
      <div className="demo-banner" style={{ background: '#ecf8f3', borderColor: '#bfe6d4', color: '#176c4e', marginBottom: 18 }}>
        <Eye size={16} />
        <span>
          本轮完成（{result.status}）：新增 Evidence {result.newEvidenceCount} 条，新呈现关系 {result.newRelationshipCount} 条。
        </span>
      </div>
    );
  }
  if (state.kind === 'error') {
    return (
      <div className="run-error" style={{ marginBottom: 18 }}>
        未能启动运行：{state.message}
      </div>
    );
  }
  return null;
}

function Metric({
  icon,
  caption,
  num,
  text,
  sub,
}: {
  readonly icon: JSX.Element;
  readonly caption: string;
  readonly num?: number;
  readonly text?: string;
  readonly sub?: string;
}): JSX.Element {
  return (
    <div className="metric">
      <div className="cap" style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
        {icon} {caption}
      </div>
      <div className="num">{num !== undefined ? num : text}</div>
      {sub !== undefined && sub.length > 0 && <div className="sub">{sub}</div>}
    </div>
  );
}

function FeedItemView({ entry }: { readonly entry: FeedEntry }): JSX.Element {
  const surfaced = entry.relationshipStatus === 'surfaced';
  return (
    <article className="feed-item">
      <div className="feed-item__head">
        <span className="feed-item__src">{entry.sourceLabel}</span>
        <span className={`status-pill ${surfaced ? 'status-pill--succeeded' : 'status-pill--failed'}`}>
          {surfaced ? <Eye size={12} /> : <EyeOff size={12} />}
          {surfaced ? '已呈现' : '未呈现'}
        </span>
        <span className="feed-item__time">{formatRelative(entry.capturedAt)}</span>
      </div>
      <div className="feed-item__claim">{entry.claim}</div>
      {entry.impliedMeaning.length > 0 && <p className="feed-item__meaning">{entry.impliedMeaning}</p>}
      <div className="feed-item__links">
        {entry.sourceUrl.length > 0 && (
          <a href={entry.sourceUrl} target="_blank" rel="noopener noreferrer">
            <ExternalLink size={12} /> 原文
          </a>
        )}
        {entry.feedUrl.length > 0 && (
          <a href={entry.feedUrl} target="_blank" rel="noopener noreferrer">
            <Rss size={12} /> Feed
          </a>
        )}
      </div>
    </article>
  );
}

function runStatusLabel(status: 'running' | 'succeeded' | 'failed' | null | undefined): string {
  switch (status) {
    case 'running':
      return '运行中';
    case 'succeeded':
      return '成功';
    case 'failed':
      return '失败';
    default:
      return '未知';
  }
}
