import { t, type Key } from '@/i18n';
import { selectTab, tabOf, useRouter, type Tab } from '@/lib/router';
import { Icon, type IconName } from './Icon';

const ITEMS: { tab: Tab; label: Key; icon: IconName }[] = [
  { tab: '/', label: 'tab.home', icon: 'home' },
  { tab: '/workouts', label: 'tab.workouts', icon: 'dumbbell' },
  { tab: '/nutrition', label: 'tab.nutrition', icon: 'food' },
  { tab: '/progress', label: 'tab.progress', icon: 'chart' },
  { tab: '/library', label: 'tab.library', icon: 'book' },
];

export function TabBar() {
  const { path } = useRouter();
  const active = tabOf(path);
  return (
    <nav className="tabbar" aria-label={t('tab.main')}>
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
          <span>{t(it.label)}</span>
        </button>
      ))}
    </nav>
  );
}
