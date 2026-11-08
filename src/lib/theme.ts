import { useEffect } from 'react';
import type { ThemePref } from '@/domain/types';
import { useData } from '@/store/useData';

export type Theme = 'light' | 'dark';

const META_BG: Record<Theme, string> = { dark: '#000000', light: '#f2f2f7' };

export function resolveTheme(pref: ThemePref, systemPrefersDark: boolean): Theme {
  if (pref === 'system') return systemPrefersDark ? 'dark' : 'light';
  return pref;
}

const systemDark = () => typeof window !== 'undefined' && !!window.matchMedia?.('(prefers-color-scheme: dark)').matches;

function setMeta(name: string, content: string) {
  let el = document.querySelector<HTMLMetaElement>(`meta[name="${name}"]`);
  if (!el) {
    el = document.createElement('meta');
    el.name = name;
    document.head.appendChild(el);
  }
  el.content = content;
}

/**
 * Apply a theme to the document. index.html runs the same logic inline before
 * first paint (no flash); this keeps it in sync when the setting or OS changes.
 * Note: in an installed iOS web app the status-bar style is read at launch, so a
 * status-bar colour change fully applies the next time the app is opened.
 */
export function applyTheme(pref: ThemePref) {
  const theme = resolveTheme(pref, systemDark());
  const root = document.documentElement;
  root.dataset.theme = theme;
  root.style.colorScheme = theme;
  setMeta('theme-color', META_BG[theme]);
  setMeta('color-scheme', theme);
  setMeta('apple-mobile-web-app-status-bar-style', theme === 'dark' ? 'black-translucent' : 'default');
}

/** Keep the document theme in sync with the setting (and the OS when set to System). */
export function useThemeSync() {
  const pref = useData((s) => s.settings.theme);
  useEffect(() => {
    applyTheme(pref);
    if (pref !== 'system' || !window.matchMedia) return;
    const mq = window.matchMedia('(prefers-color-scheme: dark)');
    const onChange = () => applyTheme('system');
    mq.addEventListener?.('change', onChange);
    return () => mq.removeEventListener?.('change', onChange);
  }, [pref]);
}
