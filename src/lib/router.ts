/**
 * Minimal hash router with iOS-style tab stacks.
 * - Each tab remembers its last path; tapping the active tab pops to its root.
 * - Navigation direction (push/pop/tab) drives screen transitions.
 * Hash routing keeps deep links working on static hosting and inside a home-screen PWA.
 */
import { useSyncExternalStore } from 'react';

export type Direction = 'push' | 'pop' | 'tab' | 'none';
export const TABS = ['/', '/workouts', '/progress', '/library', '/profile'] as const;
export type Tab = (typeof TABS)[number];

interface RouterState {
  path: string;
  direction: Direction;
  /** in-app history depth, used to decide if browser-back is safe */
  index: number;
}

const readPath = () => {
  const h = location.hash.replace(/^#/, '');
  return h.startsWith('/') ? h : '/';
};

const histIndex = () => (typeof history.state?.forgeIdx === 'number' ? (history.state.forgeIdx as number) : 0);

let state: RouterState = { path: typeof location === 'undefined' ? '/' : readPath(), direction: 'none', index: 0 };
const tabMemory = new Map<Tab, string>();
const listeners = new Set<() => void>();

export function tabOf(path: string): Tab {
  const seg = '/' + (path.split('/')[1] ?? '');
  return (TABS as readonly string[]).includes(seg) ? (seg as Tab) : '/';
}

const depth = (p: string) => p.split('/').filter(Boolean).length;

function emit(next: RouterState) {
  state = next;
  tabMemory.set(tabOf(next.path), next.path);
  listeners.forEach((l) => l());
}

if (typeof window !== 'undefined') {
  if (!history.state || typeof history.state.forgeIdx !== 'number') {
    history.replaceState({ forgeIdx: 0 }, '');
  }
  window.addEventListener('popstate', () => {
    const path = readPath();
    const idx = histIndex();
    const direction: Direction = tabOf(path) !== tabOf(state.path) ? 'tab' : idx < state.index ? 'pop' : 'push';
    emit({ path, direction, index: idx });
  });
}

export function navigate(path: string, opts: { replace?: boolean; direction?: Direction } = {}) {
  if (path === state.path) return;
  const direction =
    opts.direction ??
    (tabOf(path) !== tabOf(state.path) ? 'tab' : depth(path) >= depth(state.path) ? 'push' : 'pop');
  const index = opts.replace ? state.index : state.index + 1;
  const url = `#${path}`;
  if (opts.replace) history.replaceState({ forgeIdx: index }, '', url);
  else history.pushState({ forgeIdx: index }, '', url);
  emit({ path, direction, index });
}

/** Go back in app history when possible, otherwise to `fallback`. */
export function goBack(fallback: string) {
  if (state.index > 0) history.back();
  else navigate(fallback, { replace: true, direction: 'pop' });
}

export function selectTab(tab: Tab) {
  const current = tabOf(state.path);
  if (current === tab) {
    if (state.path !== tab) navigate(tab, { direction: 'pop' });
    else listeners.forEach((l) => l()); // allow screens to scroll-to-top
    return;
  }
  navigate(tabMemory.get(tab) ?? tab, { direction: 'tab' });
}

export function useRouter(): RouterState {
  return useSyncExternalStore(
    (cb) => {
      listeners.add(cb);
      return () => listeners.delete(cb);
    },
    () => state,
    () => state,
  );
}

/** Match `/library/exercise/:id` against a path; returns params or null. */
export function match(pattern: string, path: string): Record<string, string> | null {
  const a = pattern.split('/').filter(Boolean);
  const b = path.split('?')[0].split('/').filter(Boolean);
  if (a.length !== b.length) return null;
  const params: Record<string, string> = {};
  for (let i = 0; i < a.length; i++) {
    if (a[i].startsWith(':')) params[a[i].slice(1)] = decodeURIComponent(b[i]);
    else if (a[i] !== b[i]) return null;
  }
  return params;
}
