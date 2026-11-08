import { selectTab, tabOf, useRouter, type Tab } from '@/lib/router';
import { Icon, type IconName } from './Icon';

const ITEMS: { tab: Tab; label: string; icon: IconName }[] = [
  { tab: '/', label: 'Home', icon: 'home' },
  { tab: '/workouts', label: 'Workouts', icon: 'dumbbell' },
  { tab: '/progress', label: 'Progress', icon: 'chart' },
  { tab: '/library', label: 'Library', icon: 'book' },
  { tab: '/profile', label: 'Profile', icon: 'user' },
];

export function TabBar() {
  const { path } = useRouter();
  const active = tabOf(path);
  return (
    <nav className="tabbar" aria-label="Main">
      {ITEMS.map((it) => (
        <button
          key={it.tab}
          className={`tab ${active === it.tab ? 'is-active' : ''}`}
          aria-current={active === it.tab ? 'page' : undefined}
          onClick={() => {
            if (active === it.tab && path === it.tab) window.dispatchEvent(new Event('forge:scrolltop'));
            selectTab(it.tab);
          }}
        >
          <Icon name={it.icon} size={25} stroke={active === it.tab ? 2.3 : 1.9} />
          <span>{it.label}</span>
        </button>
      ))}
    </nav>
  );
}
