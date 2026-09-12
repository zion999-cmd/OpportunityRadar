import {
  Home,
  Briefcase,
  FileText,
  Heart,
  Inbox,
  CalendarDays,
  Compass,
  History,
  Bookmark,
  MessageSquare,
  Radar,
  type LucideIcon,
} from 'lucide-react';
import { navigate, useRoute } from '../router.js';

interface NavEntry {
  readonly key: string;
  readonly label: string;
  readonly icon: LucideIcon;
  readonly path?: string;
  readonly activeOn?: ReadonlyArray<string>;
}

const PRIMARY: ReadonlyArray<NavEntry> = [
  { key: 'today', label: '今日机会', icon: Home, path: '/', activeOn: ['home'] },
  { key: 'jobhunt', label: '我的求职', icon: Briefcase },
  { key: 'resume', label: '简历与资料', icon: FileText },
  { key: 'found', label: '已发现的机会', icon: Heart },
  { key: 'applications', label: '我的申请', icon: Inbox },
  { key: 'interviews', label: '面试日程', icon: CalendarDays },
  { key: 'explore', label: '职业探索', icon: Compass },
];

const SECONDARY: ReadonlyArray<NavEntry> = [
  { key: 'themes', label: '关注主题', icon: Radar, path: '/radar', activeOn: ['radar'] },
  { key: 'history', label: '历史语义', icon: History },
  { key: 'saved', label: '收藏', icon: Bookmark },
  { key: 'feedback', label: '反馈与建议', icon: MessageSquare },
];

export function LeftNav(): JSX.Element {
  const route = useRoute();

  return (
    <nav className="leftnav" aria-label="主导航">
      <div className="leftnav__brand">
        <span className="brand-name">
          Opportunity<em>Radar</em>
        </span>
        <span className="beta">Beta</span>
      </div>
      <p className="leftnav__tagline">看见更大的机会</p>

      {PRIMARY.map((entry) => (
        <NavButton key={entry.key} entry={entry} active={(entry.activeOn ?? []).includes(route.name)} />
      ))}

      <p className="nav-group-label">更多</p>
      {SECONDARY.map((entry) => (
        <NavButton key={entry.key} entry={entry} active={(entry.activeOn ?? []).includes(route.name)} />
      ))}

      <div className="leftnav__quote">
        <strong>让世界的信息，为你创造更多可能</strong>
        <p>From Information to Opportunity</p>
        <span className="by">— OpportunityRadar</span>
      </div>
    </nav>
  );
}

function NavButton({ entry, active }: { readonly entry: NavEntry; readonly active: boolean }): JSX.Element {
  const Icon = entry.icon;
  const className = `nav-item${active ? ' nav-item--active' : ''}`;
  const label = <span>{entry.label}</span>;

  const path = entry.path;
  if (path === undefined) {
    return (
      <button type="button" className={className} disabled title="即将推出">
        <Icon size={18} strokeWidth={2} />
        {label}
      </button>
    );
  }
  return (
    <button
      type="button"
      className={className}
      aria-current={active ? 'page' : undefined}
      onClick={() => navigate(path)}
    >
      <Icon size={18} strokeWidth={2} />
      {label}
    </button>
  );
}
