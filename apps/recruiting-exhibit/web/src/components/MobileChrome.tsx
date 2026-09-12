import { Bell, Briefcase, Compass, Eye, FolderOpen, Home, Search, TrendingUp, User, FileBarChart } from 'lucide-react';
import { navigate, useRoute } from '../router.js';

// Mobile-only (<=1023px) top bar, action-lens switch, and fixed
// bottom navigation. Only 首页 really navigates; the other
// lenses / tabs are deliberate disabled placeholders per
// task.md (单一 Action Lens: 求职/应聘).
interface MobileChromeProps {
  readonly onEditSituation: () => void;
}

export function MobileChrome({ onEditSituation }: MobileChromeProps): JSX.Element {
  const route = useRoute();

  return (
    <>
      <header className="mobile-header">
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <span className="wordmark">
              Opportunity<em>Radar</em>
            </span>
            <span className="beta">Beta</span>
          </div>
          <div className="sub">看见更大的机会</div>
        </div>
        <div className="spacer" />
        <button type="button" className="icon-btn" disabled aria-label="搜索（暂未开放）">
          <Search size={20} />
        </button>
        <button type="button" className="icon-btn" disabled aria-label="通知（暂未开放）">
          <Bell size={20} />
        </button>
        <button type="button" className="avatar" onClick={onEditSituation} aria-label="编辑我的 Situation" title="我的 Situation">
          我
        </button>
      </header>

      <div className="mobile-lensbar" role="tablist" aria-label="Action Lens">
        <button type="button" className="lens-chip lens-chip--active" role="tab" aria-selected="true">
          <Briefcase size={16} /> 求职机会
        </button>
        <button type="button" className="lens-chip" disabled role="tab" aria-selected="false" title="即将推出">
          <TrendingUp size={16} /> 投资机会
        </button>
        <button type="button" className="lens-chip" disabled role="tab" aria-selected="false" title="即将推出">
          <FileBarChart size={16} /> 行业研究
        </button>
        <button
          type="button"
          className={`lens-chip${route.name === 'radar' ? ' lens-chip--active' : ''}`}
          role="tab"
          aria-selected={route.name === 'radar'}
          onClick={() => navigate('/radar')}
        >
          <Eye size={16} /> 关注追踪
        </button>
      </div>

      <nav className="bottomnav" aria-label="底部导航">
        <button
          type="button"
          className={`bottomnav__item${route.name === 'home' ? ' bottomnav__item--active' : ''}`}
          onClick={() => navigate('/')}
        >
          <Home size={21} />
          首页
        </button>
        <button type="button" className="bottomnav__item" disabled title="即将推出">
          <Compass size={21} />
          发现
        </button>
        <button type="button" className="bottomnav__item" disabled title="即将推出">
          <FolderOpen size={21} />
          机会库
        </button>
        <button type="button" className="bottomnav__item" disabled title="即将推出">
          <User size={21} />
          我的
        </button>
      </nav>
    </>
  );
}
