import { Briefcase, Check, FileUp, Play, Radar, Upload } from 'lucide-react';
import { useAppData } from '../app-data.js';
import { navigate } from '../router.js';

interface RightActionPanelProps {
  readonly onEditSituation: () => void;
}

// Right Action Sidebar (desktop only). All numbers come from the
// existing /api/status payload; stages without persistence
// (saved / applied / interviews) honestly render "—" instead of
// inventing progress.
export function RightActionPanel({ onEditSituation }: RightActionPanelProps): JSX.Element {
  const { situation, status } = useAppData();

  const hasSituation = situation !== null && situation.rawText.trim().length > 0;
  const hasEvidence = (status?.totalEvidenceCount ?? 0) > 0;
  const hasSurfaces = (status?.totalSurfaces ?? 0) > 0;

  return (
    <>
      <section className="panel">
        <div className="profile-card">
          <span className="avatar" aria-hidden>
            我
          </span>
          <div>
            <div className="name">求职者</div>
            <div className="sub">
              <Briefcase size={12} /> 正在寻找下一份工作
            </div>
          </div>
        </div>

        <div className="panel__title">求职准备</div>
        <CheckRow done={hasSituation} label="描述我的 Situation" />
        <CheckRow done={hasEvidence} label="运行 Observation 恢复 Evidence" />
        <CheckRow done={hasSurfaces} label="查看今日恢复的意义" />
        <CheckRow done={false} label="完善简历与资料" dim />
      </section>

      <section className="panel">
        <div className="panel__title">机会进展</div>
        <div className="stat-row">
          <Stat num={String(status?.totalSurfaces ?? 0)} caption="发现机会" />
          <Stat num="—" caption="已保存" dim />
          <Stat num="—" caption="已申请" dim />
          <Stat num="—" caption="面试" dim />
        </div>
        <p className="feedback-note">本产品只负责恢复意义与关系，不做自动投递。</p>
      </section>

      <section className="panel">
        <div className="panel__title">快捷操作</div>
        <div className="quick-actions">
          <button type="button" className="btn btn--primary btn--block" onClick={onEditSituation}>
            <Upload size={16} /> 上传 / 更新我的 Situation
          </button>
          <button type="button" className="btn btn--soft btn--block" onClick={() => navigate('/radar')}>
            <Play size={16} /> 运行一轮 Observation
          </button>
          <button
            type="button"
            className="btn btn--ghost btn--block"
            disabled
            title="简历功能即将开放；本版本不做简历改写"
          >
            <FileUp size={16} /> 上传简历（即将开放）
          </button>
        </div>
      </section>

      <div className="aside__quote">
        <p>“不是更多岗位信息，而是看见世界的变化与你的关系。”</p>
        <span>
          <Radar size={12} style={{ verticalAlign: -2, marginRight: 4 }} />
          OpportunityRadar
        </span>
      </div>
    </>
  );
}

function CheckRow({ done, label, dim = false }: { readonly done: boolean; readonly label: string; readonly dim?: boolean }): JSX.Element {
  const className = `check-row${done ? ' check-row--done' : ''}${dim ? ' muted' : ''}`;
  return (
    <div className={className}>
      <span className="fake-check" aria-hidden>
        {done ? <Check size={12} /> : null}
      </span>
      {label}
    </div>
  );
}

function Stat({ num, caption, dim = false }: { readonly num: string; readonly caption: string; readonly dim?: boolean }): JSX.Element {
  return (
    <div className="stat">
      <div className={`num${dim ? ' num--dim' : ''}`}>{num}</div>
      <div className="cap">{caption}</div>
    </div>
  );
}
