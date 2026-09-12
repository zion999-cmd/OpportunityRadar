import { Bell, Pencil, Search } from 'lucide-react';
import { useAppData } from '../app-data.js';
import { situationHeadline } from '../format.js';

export function TopHeader({ onEditSituation }: { readonly onEditSituation: () => void }): JSX.Element {
  const { situation } = useAppData();
  const headline = situation === null ? '正在寻找下一份工作' : situationHeadline(situation.rawText);

  return (
    <header className="topbar">
      <button
        type="button"
        className="topbar__situation"
        style={{ background: 'none', textAlign: 'left' }}
        onClick={onEditSituation}
        title="编辑我的 Situation"
      >
        <span className="label">当前 Situation</span>
        <span className="value">{headline}</span>
      </button>

      <div className="searchbox" title="自然语言入口将在后续版本开放">
        <Search size={16} />
        <input
          type="text"
          placeholder="告诉我你现在想解决什么..."
          tabIndex={-1}
          aria-label="搜索（暂未开放）"
          readOnly
        />
      </div>

      <div className="topbar__icons">
        <button type="button" className="icon-btn" disabled title="通知暂未开放">
          <Bell size={19} />
        </button>
        <button type="button" className="icon-btn" onClick={onEditSituation} title="编辑 Situation">
          <Pencil size={16} />
        </button>
        <span className="avatar" aria-hidden>
          我
        </span>
      </div>
    </header>
  );
}
